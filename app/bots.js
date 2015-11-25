var _ = require('lodash');
var chess = require('chess.js');
var logger = require('./../setup/logging')({}).standard();
var util = require('./util');

var engineFactory = require('./engine');

var socketClientFactory = require('socket.io-client');

var Bot = function (roomName, options) {
    var self = this;
    this.name = 'bot_' + util.randomString(8);
    this.options = _.defaults(_.extend({}, options), {
        contemptFactor: Math.floor(Math.random() * 200) - 100,
        skillLevel: Math.floor(Math.random() * 10),
        aggressiveness: Math.floor(Math.random() * 100),
        autoReconnect: false,
        waitSupplier: function () {
            return Math.floor(Math.random() * 20) + 1;
        },
        moveSettingsSupplier: function () {
            var min = Math.floor(Math.random() * 4) + 1; // 1 - 4
            return {
                depth: min
            };
        }
    });

    this.engine = engineFactory(options);
    this.game = new chess.Chess();

    this.color = null;
    this.joined = false;
    this.gameOver = false;
    this.playerCount = {
        white: 0,
        black: 0
    };
    var moveTimeoutId = -1;

    var socketOptions = {
        query: 'user=' + this.name,
        forceNew: true
    };

    var isInTurn = function () {
        return !self.gameOver && self.joined && self.game.turn() === self.color.charAt(0);
    };

    var socket = socketClientFactory('http://localhost:3000', socketOptions);

    socket.on('connect', function () {
        logger.warn('Bot %s connected and wants to join room %s', self.name, roomName);
    });

    socket.on('self-player-connected', function (data) {
        logger.error('Bot %s connected to game', self.name);

        self.color = data.side;
        self.joined = true;
    });

    socket.on('new-top-rated-game-move', function (data) {
        self.gameOver = data.gameOver;

        self.game.load_pgn(data.pgn);
        self.turn = self.game.turn();

        if (!self.gameOver && isInTurn()) {
            var makeMoveInSeconds = self.options.waitSupplier();
            var moveSettings = self.options.moveSettingsSupplier;

            self.engine.startSearchForBestMove(self.game, moveSettings);

            logger.debug('Bot %s suggests move in %d seconds', self.name, makeMoveInSeconds);

            moveTimeoutId = setTimeout(function () {
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

        if (self.gameOver) {
            self.engine.newGame();
        }
    });

    socket.on('player-stats', function (data) {
        self.playerCount = data;

        /* if (self.joined && self.playerCount[self.color] > 2) {
         logger.warn('Bot %s disconnects because too many player in team %s', self.name, self.color);

         socket.disconnect();


         var reconnectInSeconds = 10;
         setTimeout(function () {
         logger.debug('Bot %s reconnects...', self.name, reconnectInSeconds);
         socket.connect();
         }, reconnectInSeconds * 1000);

         logger.debug('Bot %s reconnects in %d seconds', self.name, reconnectInSeconds);

         }*/
    });

    var joinGame = function () {
        self.engine.newGame();
        socket.emit('join-room', {
            token: roomName
        });

        if (self.options.autoReconnect) {
            var disconnectTimeout = self.options.autoReconnect.disconnectTimeout();
            logger.debug('bot %s auto-disconnects in %d seconds', self.name, disconnectTimeout / 1000);
            setTimeout(function () {
                socket.disconnect();
            }, disconnectTimeout);
        }
    };

    socket.on('disconnect', function () {
        logger.warn('Bot %s disconnected', self.name);
        self.joined = false; // TODO: set false when leaving game, not "on disconnect"
        clearTimeout(moveTimeoutId);

        if (self.options.autoReconnect) {
            var reconnectTimeout = self.options.autoReconnect.reconnectTimeout();
            logger.debug('bot %s auto-reconnects in %d seconds', self.name, reconnectTimeout / 1000);
            setTimeout(function () {
                socket.connect();
                joinGame();
            }, reconnectTimeout);
        }
    });

    joinGame();
};

module.exports = function (options) {
    return {
        createBot: function (roomName, options) {
            return new Bot(roomName, options || {});
        }
    }
};