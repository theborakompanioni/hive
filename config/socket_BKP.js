module.exports = function (server) {
    var _ = require('lodash');
    var io = require('socket.io').listen(server);
    var chess = require('chess.js');

    var DEFAULT_DIGEST_TIMEOUT = 5 * 1000;
    /*
     * Socket to use to broadcast monitoring events
     */
    var monitor = io.of('/monitor');
    monitor.on('connection', function (socket) {
        socket.emit('update', {nbUsers: users, nbGames: Object.keys(games).length});
    });

    var games = {};
    var users = 0;

    var createGame = function (room) {
        console.log('create new game in room: ' + room);
        var game = new chess.Chess(); // fake game (playing random moves). It should be a real game being played on the server

        return {
            instance: game, // TODO: replace with chess: game
            room: room,
            //creator: socket,
            status: 'waiting',
            creationDate: Date.now(),
            players: [],
            playerCount: {
                white: 0,
                black: 0
            },
            possibleMoves: game.moves({verbose: true}),
            suggestedMoves: {
                white: {},
                black: {}
            },
            lastMoves: [],
            nextDigestTime: -1,
            latestDigestTime: -1
        }
    };

    var getMoveForColorOrNull = function (game, color) {
        var max = 0;
        var moveKey = null;
        _.forEach(game.suggestedMoves[color], function (value, key) {
            if (value > max) {
                moveKey = key;
                max = value;
            }
        });

        if (moveKey === null) {
            return null;
        }

        var move = _.findWhere(game.possibleMoves, {
            san: moveKey
        });

        if (move) {
            move.promotion = 'q';
        }

        return move;
    };

    var getMoveForColorOrRandom = function (game, color) {
        var move = getMoveForColorOrNull(game, color);
        if (move === null) {
            move = game.possibleMoves[Math.floor(Math.random() * game.possibleMoves.length)];
            move.promotion = 'q'; // NOTE: always promote to a queen for example simplicity
            move.__debug_random = true;
        }
        return move;
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


    var suggestMoveForColor = function (game, color, data) {
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
        if (!isValidMove(game, data)) {
            return;
        }
        var validMove = asValidMoveOrNull(game, data);

        var moveKey = validMove.san;
        if (!game.suggestedMoves[color][moveKey]) {
            game.suggestedMoves[color][moveKey] = 0;
        }
        game.suggestedMoves[color][moveKey]++;

        return validMove;
    };

    var makeMove = function (game, color, move) {
        game.instance.move(move);
        game.lastMoves.push(move);

        game.possibleMoves = game.instance.moves({verbose: true});
        game.suggestedMoves[color] = {};
    };

    var startNewGame = function (room) {
        // If the player is the first to join, initialize the game and players array
        // TODO: delete board after user leaves if it is not game created by the server!
        games[room] = createGame(room);
        return games[room];
    };

    var getGameOrNull = function (room) {
        if (!games.hasOwnProperty(room)) {
            return null;
        }

        return games[room] || null;
    };
    var getOrCreateGame = function (room) {
        if (getGameOrNull(room) === null) {
            return startNewGame(room);
        }

        return games[room];
    };

    var digest = function (cycleNumber, room, timeout) {
        var game = getGameOrNull(room);

        var shouldStartNewGame = game === null ||
            game.instance.game_over() === true ||
            game.instance.in_draw() === true ||
            game.possibleMoves.length === 0;

        if (shouldStartNewGame) {
            game = startNewGame(room);
        } else {
            var color = game.instance.turn() === 'b' ? 'black' : 'white';
            var move = getMoveForColorOrRandom(game, color);
            makeMove(game, color, move);
        }

        game.latestDigestTime = Date.now();
        game.nextDigestTime = Date.now() + timeout;

        io.sockets.to(game.room).emit('new-top-rated-game-move', {
            fen: game.instance.fen(),
            pgn: game.instance.pgn(),
            turn: game.instance.turn(),
            move: move,
            latestDigestTime: game.latestDigestTime,
            nextDigestTime: game.nextDigestTime,
            digestTimeout: timeout
        });

        setTimeout(function () {
            digest(cycleNumber, room, timeout);
        }, timeout);
    };


    /*******
     * INITIALIZE FOREVER BOARDS
     **/
    var MASTER_BOARD_ROOM = 'the-master-board';

    (function initMasterHiveGame(room, timeout) {
        console.log('init digest time of game in room ' + room);
        digest(1, room, timeout);
    })(MASTER_BOARD_ROOM, DEFAULT_DIGEST_TIMEOUT);

    /**
     * INITIALIZE FOREVER BOARDS - end
     *******/


    var searchPlayerInRoomBySocket = function (room, socket) {
        if (!games.hasOwnProperty(room)) {
            return [];
        }
        var game = games[room];
        return _.findWhere(game.players, {
            socket: socket
        });
    };

    var removePlayerFromRoom = function (room, socket) {
        if (!games.hasOwnProperty(room)) {
            return;
        }
        var game = games[room];

        var removedPlayers = _.remove(game.players, function (player) {
            return player.socket === socket;
        });

        _.forEach(removedPlayers, function (player) {
            socket.broadcast.to(room).emit('player-disconnected');
            game.playerCount[player.side]--;
        });

        socket.broadcast.to(room).emit('player-stats', game.playerCount);
        monitor.emit('update', {nbUsers: users, nbGames: Object.keys(games).length});
    };

    var asColorOrNull = function (anyColor) {
        return anyColor === 'black' || anyColor === 'white' ? anyColor : null;
    };

    var asColorOrRandom = function (anyColor) {
        var colorOrNull = asColorOrNull(anyColor);
        return colorOrNull !== null ? colorOrNull :
            (Math.random() >= 0.5 ? 'black' : 'white');
    };

    var chooseColorForNewPlayer = function (game) {
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

    var addPlayerToRoom = function (room, player) {
        if (!games.hasOwnProperty(room)) {
            return;
        }
        var game = games[room];

        var socket = player.socket;
        var side = player.side;
        var username = player.username;

        /* TODO: handle full case, a third player attempts to join the game after already 2 players has joined the game
         if (game.status === "ready") {
         socket.emit('full');
         }*/

        game.status = 'ready';
        game.playerCount[side]++;

        console.log('player joined game: ' + player.name);

        game.players.push(player);

        socket.join(room);

        io.sockets.to(room).emit('player-connected', {
            name: username,
            status: 'joined',
            side: side
        });

        io.sockets.to(room).emit('player-stats', game.playerCount);
    };

    io.sockets.on('connection', function (socket) {
        var username = socket.handshake.query.user;

        users++;
        monitor.emit('update', {nbUsers: users, nbGames: Object.keys(games).length});

        /*
         * A player joins a game
         */
        socket.on('player-connect', function (data) {
            var room = data.token;

            var game = getOrCreateGame(room);

            var side = chooseColorForNewPlayer(game);

            /*
             if(asColorOrNull(side) === null) {
             return;
             }*/

            socket.emit('new-top-rated-game-move', {
                fen: game.instance.fen(),
                pgn: game.instance.pgn(),
                turn: game.instance.turn(),
                move: game.lastMoves.length > 0 ? game.lastMoves[game.lastMoves.length - 1] : null,
                latestDigestTime: game.latestDigestTime,
                nextDigestTime: game.nextDigestTime,
                digestTimeout: DEFAULT_DIGEST_TIMEOUT
            });

            var player = {
                socket: socket,
                name: username,
                status: 'joined',
                side: side
            };

            addPlayerToRoom(room, player);
            var suggestedMovesMsg = {
                team: game.suggestedMoves[side],
                white: game.suggestedMoves.white,
                black: game.suggestedMoves.black
            };

            socket.emit('suggested-moves', suggestedMovesMsg);


            socket.emit('self-connected', {
                side: side
            });
        });

        /*
         * A player makes a new move => broadcast that move to the opponent
         */
        socket.on('new-move', function (data) {
            var room = data.token;
            if (!games.hasOwnProperty(room)) {
                return;
            }
            var game = games[room];

            var playerOrNull = searchPlayerInRoomBySocket(room, socket);
            var playerIsInRoom = playerOrNull !== null;

            if (!playerIsInRoom) {
                return;
            }

            var providedTurn = data.turn !== 'white' && data.turn !== 'black' ? undefined : data.turn;
            var playerHasColorHeProvided = playerOrNull.side === providedTurn;
            var playerIsInTurn = playerOrNull.side.charAt(0) === game.instance.turn();
            if (!playerHasColorHeProvided || !playerIsInTurn) {
                return;
            }

            if (!isValidMove(game, data)) {
                return;
            }
            var acceptedSuggestedMove = suggestMoveForColor(game, providedTurn, data);

            // TODO: do not send moves to opponents
            socket.broadcast.to(room).emit('new-move', acceptedSuggestedMove); // send to other users
            socket.emit('new-move', acceptedSuggestedMove); // send to self

            var suggestedMovesMsg = {
                team: game.suggestedMoves[playerOrNull.side],
                white: game.suggestedMoves.white,
                black: game.suggestedMoves.black
            };
            socket.broadcast.to(room).emit('suggested-moves', suggestedMovesMsg); // send to other users
            socket.emit('suggested-moves', suggestedMovesMsg); // send to self
        });

        /*
         * A player resigns => notify opponent, leave game room and delete the game
         */
        socket.on('new-vote-resign', function (data) {
            console.log('user voted for resignation');
            var room = data.token;
            if (games.hasOwnProperty(room)) {
                //io.sockets.to(room).emit('player-resigned', {
                //    side: data.side
                //});
                //games[room].players[0].socket.leave(room);
                //games[room].players[1].socket.leave(room);
                //delete games[room];
                //monitor.emit('update', {nbUsers: users, nbGames: Object.keys(games).length});
            }
        });

        socket.on('player-disconnect', function (data) {
            var room = data.token;
            if (games.hasOwnProperty(room)) {
                removePlayerFromRoom(room, socket);
            }
        });
        /*
         * A player disconnects => notify opponent, leave game room
         */
        socket.on('disconnect', function (data) {
            users--;
            monitor.emit('update', {nbUsers: users, nbGames: Object.keys(games).length});

            _.forEach(games, function (game, room) {
                removePlayerFromRoom(room, socket);
            });
        });
    });

};