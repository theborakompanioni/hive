var _ = require('lodash');
var chess = require('chess.js');

var util = require('./util');
var logger = require('./logging')({}).standard();

var noop = function () {
};

module.exports = function () {
    var DEFAULT_DIGEST_TIMEOUT = 30.5 * 1000;
    var HotSeatChessGame = function (room) {
        // TODO: implement a queue chessgame.
        // winner stays, loser gets disconnected
        // next in queue is next opponent

        // but everybody in the room can make suggests!
        // regular chess times -> single hard constraints

        // if one fails to make a move within 30 sec
        // -> disconnected
    };

    var HiveChessGame = function (room) {
        logger.info('create new game in room: ' + room);
        var game = new chess.Chess();

        this.name = util.randomString(8);
        this.instance = game;
        this.room = room;
        //creator: socket;
        this.status = 'waiting';
        this.creationDate = Date.now();
        this.players = [];
        this.playerCount = {
            white: 0,
            black: 0
        };
        this.possibleMoves = game.moves({verbose: true});
        this.suggestedMoves = {
            white: {},
            black: {}
        };
        this.lastMoves = [];
        this.nextDigestTime = -1;
        this.latestDigestTime = -1;
        this.digestTimeout = DEFAULT_DIGEST_TIMEOUT;
        this.cancelDigestTimeout = noop;

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

            player.socket.emit('player-stats', this.playerCount);
            player.socket.broadcast.to(this.room).emit('player-stats', this.playerCount);
        };

        this.addPlayer = function (player) {
            if (this.hasPlayer(player)) {
                return;
            }

            var side = chooseColorForNewPlayer(this, player);

            this.status = 'ready';
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

            player.socket.emit('new-top-rated-game-move', {
                fen: this.instance.fen(),
                pgn: this.instance.pgn(),
                turn: this.instance.turn(),
                move: this.lastMoves.length > 0 ? this.lastMoves[this.lastMoves.length - 1] : null,
                latestDigestTime: this.latestDigestTime,
                nextDigestTime: this.nextDigestTime,
                digestTimeout: this.digestTimeout
            });

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
                var countOfSuggestedMove = game.suggestedMoves[playerInRoom.side][acceptedSuggestedMove.san];
                var moreThanHalfHaveVotedForCurrentMove = countOfSuggestedMove > Math.floor(teamSize / 2);

                if (moreThanHalfHaveVotedForCurrentMove) {
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

        this.makeMove = function (color, move) {
            this.instance.move(move);
            this.lastMoves.push(move);

            this.possibleMoves = this.instance.moves({verbose: true});
            this.suggestedMoves[color] = {};
        };

        this.start = function () {
            var game = new chess.Chess();
            this.instance = game;
            this.startDate = Date.now();
            this.possibleMoves = game.moves({verbose: true});
            this.suggestedMoves = {
                white: {},
                black: {}
            };
            this.lastMoves = [];
            this.digestCount = 0;
            this.nextDigestTime = -1;
            this.latestDigestTime = -1;
            this.cancelDigestTimeout = noop;

            this.digest();
        };
        this.stop = function () {
            if (this.cancelDigestTimeout) {
                this.cancelDigestTimeout();
                this.cancelDigestTimeout = noop;
            }
        };
        this.restart = function () {
            this.stop();
            this.start();
        };
        this.digest = function () {
            logger.debug('game %s digest loop %d starts', this.name, this.digestCount);
            this.cancelDigestTimeout();

            this.latestDigestTime = Date.now();
            this.nextDigestTime = Date.now() + this.digestTimeout;

            var maxRoundsReached = this.digestCount > 300;
            var shouldRestartGame = maxRoundsReached ||
                this.instance.game_over() === true ||
                this.instance.in_draw() === true ||
                this.possibleMoves.length === 0;

            if (shouldRestartGame) {
                this.restart();
            }

            var isFirstRun = this.digestCount === 0;
            if (!isFirstRun) {
                var color = this.instance.turn() === 'b' ? 'black' : 'white';
                var move = this.getMoveForColorOrRandom(color);
                this.makeMove(color, move);
            }

            var firstPlayer = this.players[0];
            if (firstPlayer) {
                var newTopRatedGameMoveMsg = {
                    fen: this.instance.fen(),
                    pgn: this.instance.pgn(),
                    turn: this.instance.turn(),
                    move: move,
                    latestDigestTime: this.latestDigestTime,
                    nextDigestTime: this.nextDigestTime,
                    digestTimeout: this.digestTimeout
                };

                firstPlayer.socket.emit('new-top-rated-game-move', newTopRatedGameMoveMsg);
                firstPlayer.socket.broadcast.to(this.room).emit('new-top-rated-game-move', newTopRatedGameMoveMsg);
            }


            var self = this;
            this.cancelDigestTimeout = (function scheduleNextDigest(game, timeout, nextDigestCount) {
                logger.debug('game %s schedule loop digest %d in %d seconds',
                    self.name, nextDigestCount, Math.floor(timeout / 1000));
                var cancelTimeoutId = setTimeout(function () {
                    self.cancelDigestTimeout = noop;
                    game.digest();
                }, timeout);

                return function () {
                    logger.debug('game %s cancel schedule for digest loop %d', self.name, nextDigestCount);
                    clearTimeout(cancelTimeoutId);
                };
            })(this, this.digestTimeout, this.digestCount + 1);

            logger.debug('game %s digest loop %d ended', this.name, this.digestCount);
            this.digestCount++;
        };

        var chooseColorForNewPlayer = function (game, player) {
            var whites = game.playerCount.white;
            var blacks = game.playerCount.black;

            /*if (whites === 0) {
             return 'white';
             }*/
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