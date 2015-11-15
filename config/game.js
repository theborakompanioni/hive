var _ = require('lodash');
var chess = require('chess.js');

var util = require('./util');
var logger = require('./logging')({}).standard();

var noop = function () {
};

module.exports = function () {
    var DEFAULT_DIGEST_TIMEOUT_PLAYER = 30.5 * 1000;
    var DEFAULT_DIGEST_TIMEOUT_NOPLAYER = 5.5 * 1000;
    var HotSeatChessGame = function (room) {
        // TODO: implement a queue chessgame.
        // winner stays, loser gets disconnected
        // next in queue is next opponent

        // but everybody in the room can make suggests!
        // regular chess times -> single hard constraints

        // if one fails to make a move within 30 sec
        // -> disconnected
    };

    var HiveChessGame = function (room, options) {
        this.options = _.defaults(_.extend({}, options), {
            autoRestart: true,
            restartTimeout: 15000,
            maxRounds: 400,
            destroyWhenLastPlayerLeft: true
        });
        this.room = room;
        this.name = util.randomString(8);
        this.players = [];
        this.playerCount = {
            white: 0,
            black: 0
        };
        this.creationDate = Date.now();
        this.status = 'init';

        logger.info('init new game in room: ' + this.room);

        this._reset = function () {
            var game = new chess.Chess();
            this.instance = game;

            this.possibleMoves = game.moves({verbose: true});
            this.suggestedMoves = {
                white: {},
                black: {}
            };
            this.lastMoves = [];
            this.digestCount = 0;
            this.digestTimeout = DEFAULT_DIGEST_TIMEOUT_PLAYER;
            this.nextDigestTime = -1;
            this.latestDigestTime = -1;
            this.cancelDigestTimeout = noop;
            this.cancelRestartTimeout = noop;
            this.colorToMove = 'white';
        };

        this.hasPlayer = function (player) {
            return !!_.findWhere(this.players, {
                socket: player.socket
            });
        };

        this.removePlayer = function (player) {
            var removedPlayers = _.remove(this.players, function (p) {
                return player.socket === p.socket;
            });

            _.forEach(removedPlayers, function (removedPlayer) {
                removedPlayer.socket.broadcast.to(this.room).emit('player-disconnected');
                this.playerCount[removedPlayer.side]--;
            }, this);

            player.socket.broadcast.to(this.room).emit('player-stats', this.playerCount);

            var gameHasPlayers = this.players.length > 0;
            if (!gameHasPlayers) {
                if (this.options.destroyWhenLastPlayerLeft) {
                    logger.info('game %s stopped because last player left', this.name);
                    this.stop();
                    // TODO: remove game from room
                }
            }
        };

        this.createTopRatedMoveMessage = function (moveOrUndefined) {
            var move = moveOrUndefined ||
                (this.lastMoves.length > 0 ? this.lastMoves[this.lastMoves.length - 1] : null);

            var gameOver = this.isGameOver();
            var inDraw = this.instance.in_draw();
            var colorToMove = this.colorToMove;
            var oppositeColor = colorToMove === 'white' ? 'white' : 'black';
            return {
                fen: this.instance.fen(),
                pgn: this.instance.pgn(),
                turn: this.instance.turn(),
                move: move,
                latestDigestTime: this.latestDigestTime,
                nextDigestTime: this.nextDigestTime,
                digestTimeout: this.digestTimeout,
                gameOver: gameOver,
                inDraw: inDraw,
                colorToMove: this.colorToMove,
                winner: inDraw ? 'draw' : oppositeColor
            };
        };

        this.addPlayer = function (player) {
            if (this.hasPlayer(player)) {
                return;
            }

            var side = chooseColorForNewPlayer(this, player);

            var oppositeColor = side === 'white' ? 'black' : 'white';
            if (this.playerCount[oppositeColor] <= 0) {
                this.restart();
            }

            this.playerCount[side]++;
            var gamePlayer = _.extend({}, player, {
                side: side
            });
            this.players.push(gamePlayer);

            logger.debug('player %s connected to game %s on side %s', player.name, this.name, gamePlayer.side);

            var self = this;
            player.socket.on('disconnect', function (data) {
                self.removePlayer(player);
            });
            /*
             if(asColorOrNull(side) === null) {
             return;
             }*/

            player.socket.emit('self-player-connected', {
                side: side
            });
            player.socket.broadcast.to(this.room).emit('player-connected', {
                name: player.name,
                side: side
            });

            player.socket.emit('new-top-rated-game-move', this.createTopRatedMoveMessage());

            player.socket.emit('player-stats', this.playerCount);
            player.socket.broadcast.to(this.room).emit('player-stats', this.playerCount);

            var suggestedMovesMsg = {
                team: this.suggestedMoves[side],
                white: this.suggestedMoves.white,
                black: this.suggestedMoves.black
            };

            player.socket.emit('suggested-moves', suggestedMovesMsg);

            /*
             * A player makes a new move => broadcast that move to the opponent
             */
            var game = this;
            player.socket.on('new-move', function (data) {
                var room = data.token;

                if (game.room !== room) {
                    return;
                }
                logger.debug('player %s suggests a move in game %s', player.name, game.name);

                var playerInRoom = _.findWhere(game.players, {
                    socket: player.socket
                });
                var playerIsInRoom = playerInRoom !== null;

                if (!playerIsInRoom) {
                    return;
                }

                var providedTurn = data.turn !== 'white' && data.turn !== 'black' ? undefined : data.turn;
                var playerHasColorHeProvided = playerInRoom.side === providedTurn;
                var playerIsInTurn = playerInRoom.side.charAt(0) === game.instance.turn();
                if (!playerHasColorHeProvided || !playerIsInTurn) {
                    return;
                }

                if (!isValidMove(game, data)) {
                    logger.warn('player %s provided illegal move in game %s', player.name, game.name);
                    return;
                }

                var acceptedSuggestedMove = game.suggestMoveForColor(providedTurn, data);
                logger.debug('player %s suggests valid move %s in game %s', player.name, acceptedSuggestedMove.san, game.name);

                playerInRoom.socket.emit('new-move', acceptedSuggestedMove);
                // TODO: do not send moves to opponents
                playerInRoom.socket.broadcast.to(game.room).emit('new-move', acceptedSuggestedMove);

                var suggestedMovesMsg = {
                    team: game.suggestedMoves[playerInRoom.side],
                    white: game.suggestedMoves.white,
                    black: game.suggestedMoves.black
                };
                playerInRoom.socket.emit('suggested-moves', suggestedMovesMsg);
                playerInRoom.socket.broadcast.to(game.room).emit('suggested-moves', suggestedMovesMsg);

                var teamSize = game.playerCount[playerInRoom.side];
                var suggestedMovesForCurrentTeam = game.suggestedMoves[playerInRoom.side];
                var countOfSuggestedMove = suggestedMovesForCurrentTeam[acceptedSuggestedMove.san];
                var moreThanHalfHaveVotedForCurrentMove = countOfSuggestedMove > Math.floor(teamSize / 2);

                var countOfVotesForTeam = _.sum(suggestedMovesForCurrentTeam);
                var allPlayersOfTeamVoted = countOfVotesForTeam === teamSize;
                if (allPlayersOfTeamVoted || moreThanHalfHaveVotedForCurrentMove) {
                    game.digest();
                }
            });
        };

        this.getMoveForColorOrNull = function (color) {
            var max = 0;
            var moveKey = null;
            _.forEach(this.suggestedMoves[color], function (value, key) {
                if (value > max) {
                    moveKey = key;
                    max = value;
                }
            });

            if (moveKey === null) {
                return null;
            }

            var move = _.findWhere(this.possibleMoves, {
                san: moveKey
            });

            if (move && !move.promotion) {
                move.promotion = 'q';
            }

            return move;
        };

        this.getMoveForColorOrRandom = function (color) {
            var move = this.getMoveForColorOrNull(color);
            if (move === null) {
                move = this.possibleMoves[Math.floor(Math.random() * this.possibleMoves.length)];
                move.promotion = 'q'; // NOTE: always promote to a queen for example simplicity
                move.__debug_random = true;
            }
            return move;
        };

        this.suggestMoveForColor = function (color, data) {
            /*
             data := {
             token: token,
             source: source,
             target: target,
             piece: piece,
             turn: game.turn() === 'b' ? 'black' : 'white',
             newPosition: ChessBoard.objToFen(newPos),
             oldPosition: ChessBoard.objToFen(oldPos)
             }
             */
            if (!isValidMove(this, data)) {
                return;
            }
            var validMove = asValidMoveOrNull(this, data);

            var moveKey = validMove.san;
            if (!this.suggestedMoves[color][moveKey]) {
                this.suggestedMoves[color][moveKey] = 0;
            }
            this.suggestedMoves[color][moveKey]++;

            return validMove;
        };

        this.makeMove = function (move) {
            this.suggestedMoves[this.colorToMove] = {};

            this.instance.move(move);
            this.lastMoves.push(move);

            this.possibleMoves = this.instance.moves({verbose: true});

            this.colorToMove = this.instance.turn() === 'b' ? 'black' : 'white';
        };

        this.start = function () {
            this._reset();
            this.startDate = Date.now();
            this.status = 'started';
            logger.debug('game %s %s', this.name, this.status);

            this.digest();
        };

        this.stop = function () {
            this.cancelDigestTimeout();
            this.cancelDigestTimeout = noop;
        };

        this.restart = function () {
            this.cancelRestartTimeout();
            this.cancelRestartTimeout = noop;

            this.stop();
            this.start();
        };

        this.isGameOver = function () {
            var maxRoundsReached = this.digestCount >= this.options.maxRounds;
            var isGameOver = maxRoundsReached ||
                this.instance.game_over() === true ||
                this.instance.in_draw() === true ||
                this.possibleMoves.length === 0;

            return isGameOver;
        };

        this.shouldRestart = function () {
            return this.isGameOver() && !!this.options.autoRestart;
        };

        this.digest = function () {
            logger.debug('game %s digest loop %d starts', this.name, this.digestCount);
            this.cancelDigestTimeout();

            this.latestDigestTime = Date.now();

            var firstPlayer = this.players[0];
            var gameHasPlayers = !!firstPlayer;

            var currentColorToMove = this.colorToMove;

            var nextDigest = this.digestTimeout;
            var oppositeColorTeamSize = this.playerCount[currentColorToMove === 'white' ? 'black' : 'white'];
            if (oppositeColorTeamSize <= 0) {
                nextDigest = Math.min(DEFAULT_DIGEST_TIMEOUT_PLAYER, DEFAULT_DIGEST_TIMEOUT_NOPLAYER);
            }

            this.nextDigestTime = Date.now() + nextDigest;

            if (!this.isGameOver()) {
                var isFirstRun = this.digestCount === 0;

                var moveMadeOrNull = null;

                if (!isFirstRun) {
                    var move = this.getMoveForColorOrRandom(currentColorToMove);
                    this.makeMove(move);
                    moveMadeOrNull = move;
                }

                if (gameHasPlayers) {
                    var newTopRatedGameMoveMsg = this.createTopRatedMoveMessage(moveMadeOrNull);
                    firstPlayer.socket.emit('new-top-rated-game-move', newTopRatedGameMoveMsg);
                    firstPlayer.socket.broadcast.to(this.room).emit('new-top-rated-game-move', newTopRatedGameMoveMsg);
                }
            }

            if (!this.isGameOver()) {
                this.cancelDigestTimeout = (function scheduleNextDigest(game, timeout, nextDigestCount) {
                    logger.debug('game %s schedule loop digest %d in %d seconds',
                        game.name, nextDigestCount, Math.floor(timeout / 1000));

                    var cancelTimeoutId = setTimeout(function () {
                        game.cancelDigestTimeout = noop;
                        game.digest();
                    }, timeout);

                    return function () {
                        logger.debug('game %s cancel schedule for digest loop %d', game.name, nextDigestCount);
                        clearTimeout(cancelTimeoutId);
                    };
                })(this, nextDigest, this.digestCount + 1);
            } else {
                this.status = 'ended';
                logger.debug('game %s %s', this.name, this.status);

                var shouldRestart = this.shouldRestart();
                if (gameHasPlayers) {
                    var gameOverMsg = {
                        winner: currentColorToMove,
                        inDraw: this.instance.in_draw(),
                        restarts: shouldRestart,
                        restartTime: Date.now() + this.options.restartTimeout
                    };
                    firstPlayer.socket.emit('game-over', gameOverMsg);
                    firstPlayer.socket.broadcast.to(this.room).emit('game-over', gameOverMsg);
                }

                if (shouldRestart) {
                    this.cancelRestartTimeout = (function scheduleRestart(game, timeout) {
                        logger.debug('game %s restarts in %d seconds', game.name, Math.floor(timeout / 1000));
                        var cancelTimeoutId = setTimeout(function () {
                            game.restart();
                        }, timeout);

                        return function () {
                            logger.debug('game %s cancel restart', game.name);
                            clearTimeout(cancelTimeoutId);
                        };
                    })(this, this.options.restartTimeout);
                }
            }

            logger.debug('game %s digest loop %d ended', this.name, this.digestCount);
            this.digestCount++;
        };

        var chooseColorForNewPlayer = function (game, player) {
            var whites = game.playerCount.white;
            var blacks = game.playerCount.black;

            if (whites === 0) {
                return 'white';
            }
            if (whites < blacks) {
                return 'white';
            }
            if (blacks < whites) {
                return 'black';
            }

            return (Math.random() >= 0.5 ? 'black' : 'white');
        };

        var asValidMoveOrNull = function (game, data) {
            var validMove = _.findWhere(game.possibleMoves, {
                from: data.source,
                to: data.target
            });
            return validMove;
        };

        var isValidMove = function (game, data) {
            return !!asValidMoveOrNull(game, data);
        };

        // start the game immediately
        this.start();
    };

    return {
        HiveChessGame: function () {
            return HiveChessGame;
        }
    }
};