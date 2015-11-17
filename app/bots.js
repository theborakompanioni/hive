var _ = require('lodash');
var chess = require('chess.js');
var logger = require('./../setup/logging')({}).standard();
var util = require('./util');

var engineFactory = require('./engine');

var socketClientFactory = require('socket.io-client');

var Bot = function (roomName, options) {
    var self = this;
    this.name = 'bot_' + util.randomString(8);
    this.options = _.defaults(_.extend({}, options), {});

    this.engine = engineFactory();
    this.game = new chess.Chess();

    this.color = null;
    this.joined = false;
    this.gameOver = false;
    this.playerCount = {
        white: 0,
        black: 0
    };

    var socketOptions = {
        query: 'user=' + this.name
    };

    var isInTurn = function () {
        return !self.gameOver && self.joined && self.game.turn() === self.color.charAt(0);
    };

    var socket = socketClientFactory('http://localhost:3000', socketOptions);

    socket.on('connect', function () {
        logger.debug('Bot %s connected', self.name);

        socket.emit('join-room', {
            token: roomName
        });
    });

    socket.on('self-player-connected', function (data) {
        logger.debug('Bot %s connected to game', self.name);

        self.color = data.side;
        self.joined = true;
    });

    socket.on('new-top-rated-game-move', function (data) {
        self.gameOver = data.gameOver;

        logger.debug('Bot %s recaived new-top-rated-game-move %s', self.name, data.pgn);

        self.game.load_pgn(data.pgn);
        self.turn = self.game.turn();


        var makeMoveInSeconds = Math.floor(Math.random() * 7) + 3;
        var moveSettings = {
            wtime: (makeMoveInSeconds - 1) * 1000, // time left for white: 30 seconds
            btime: 3000, // time left for black: 3 seconds
            winc: 0,
            binc: 0
        };
        self.engine.startSearchForBestMove(self.game, moveSettings);

        if (isInTurn()) {
            logger.debug('Bot %s suggests move in %d seconds', self.name, makeMoveInSeconds);

            setTimeout(function () {
                if (isInTurn()) {
                    var engineMove = self.engine.getForBestMoveOrNull();
                    if (!engineMove) {
                        logger.error('Bot %s could not find a good move', self.name);
                    } else {
                        var move = self.game.move(engineMove);
                        var vote = {
                            token: roomName,
                            turn: self.color,
                            resign: false,
                            move: {
                                san: move.san,
                                source: engineMove.from,
                                target: engineMove.to
                            }
                        };

                        logger.error('Bot %s SUGGESTS MOVE:', self.name, vote);

                        socket.emit('new-move', vote);
                    }
                }
            }, makeMoveInSeconds * 1000);
        }
    });

    socket.on('player-stats', function (data) {
        self.playerCount = data;

        if (self.joined && self.playerCount[self.color] > 2) {
            socket.disconnect();

            logger.debug('Bot %s disconnects because too many player in team %s', self.name, self.color);

            var reconnectInSeconds = 10;
            setTimeout(function () {
                logger.debug('Bot %s reconnects...', self.name, reconnectInSeconds);
                socket.connect();
            }, reconnectInSeconds * 1000);

            logger.debug('Bot %s reconnects in %d seconds', self.name, reconnectInSeconds);

        }
    });

    socket.on('disconnect', function () {
        logger.debug('Bot %s disconnected', self.name);
        self.joined = false; // TODO: set false when leaving game, not "on disconnect"
    });
};

module.exports = function (options) {
    return {
        createBot: function (roomName, options) {
            return new Bot(roomName, options || {});
        }
    }
};