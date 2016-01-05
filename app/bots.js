var _ = require('lodash');
var chess = require('chess.js');
var logger = require('./../setup/logging')({}).standard();
var util = require('./util');

var engineFactory = require('./engine').PlayerEngine;

var socketClientFactory = require('socket.io-client');

var Bot = function (roomName, options) {
    var self = this;
    this.name = 'bot_' + util.randomString(8);
    this.options = _.defaults(_.extend({}, options), {
        contemptFactor: Math.round(Math.random() * 200) - 100,
        skillLevel: Math.round(Math.random() * 12) + 3,
        autoReconnect: false,
        waitSupplier: function () {
            return Math.floor(Math.random() * 20) + 1;
        },
        moveSettingsSupplier: function () {
            var min = Math.round(Math.random() * 3) + 1; // 1 - 4
            return {
                depth: min
            };
        },
        resignsOnEvaluationPredicate: (function () {
            var shouldResign = function (evaluation) {
                if (evaluation === null) {
                    return false;
                }
                var random = Math.random();

                if (random < 0.01) {
                    return true;
                }
                if (evaluation > 0) {
                    return false; // leave early
                }

                if (evaluation < -2.5 && random < 0.05) {
                    return true;
                }
                if (evaluation < -5 && random < 0.1) {
                    return true;
                }
                if (evaluation < -10 && random < 0.50) {
                    return true;
                }
                if (evaluation < -15 && random < 0.80) {
                    return true;
                }
                if (evaluation < -17.5 && random < 0.90) {
                    return true;
                }
                if (evaluation < -20) {
                    return true;
                }

                return false;
            };

            var lastTotalEvaluationOrNull = null;
            return function (totalEvaluationOrNull) {
                var evaluation = Math.max(totalEvaluationOrNull || 0, lastTotalEvaluationOrNull || 0);
                var resign = shouldResign(evaluation);

                lastTotalEvaluationOrNull = totalEvaluationOrNull;

                return resign;
            }
        })()
    });

    logger.warn('create bot with skill level %d', this.options.skillLevel);

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
        logger.debug('Bot %s connected and wants to join room %s', self.name, roomName);
    });

    socket.on('self-player-connected', function (data) {
        logger.debug('Bot %s connected to game', self.name);

        self.color = data.side;
        self.joined = true;
    });

    socket.on('new-top-rated-game-move', function (data) {
        self.gameOver = data.gameOver;

        self.game.load_pgn(data.pgn);
        self.turn = self.game.turn();

        self.engine.analyze(self.game);

        if (!self.gameOver && isInTurn()) {
            var makeMoveInSeconds = self.options.waitSupplier();
            var moveSettings = self.options.moveSettingsSupplier;

            self.engine.startSearchForBestMove(self.game, moveSettings);

            logger.debug('Bot %s suggests move in %d seconds', self.name, makeMoveInSeconds);

            moveTimeoutId = setTimeout(function () {
                if (isInTurn()) {
                    var totalEvaluationOrNull = self.engine.getTotalEvaluationForColorOrNull();
                    if (totalEvaluationOrNull !== null && self.color === 'black') {
                        totalEvaluationOrNull *= -1;
                    }

                    var shouldResign = self.options.resignsOnEvaluationPredicate(totalEvaluationOrNull);
                    if (shouldResign) {
                        var vote = {
                            token: roomName,
                            turn: self.color,
                            resign: true,
                            move: {
                                san: 'resgin'
                            }
                        };

                        logger.warn('Bot %s suggests resignation', self.name);

                        socket.emit('new-move', vote);
                    } else {
                        var engineMoveOrNull = self.engine.getBestMoveOrNull();
                        if (!engineMoveOrNull) {
                            logger.warn('Bot %s could not find a good move', self.name);
                        } else {
                            var moveOrNull = self.game.move(engineMoveOrNull);
                            if (!moveOrNull) {
                                logger.warn('Bot %s provided an illegal move %j', self.name, moveOrNull);
                            } else {
                                var vote = {
                                    token: roomName,
                                    turn: self.color,
                                    resign: false,
                                    move: {
                                        san: moveOrNull.san,
                                        source: engineMoveOrNull.from,
                                        target: engineMoveOrNull.to
                                    }
                                };

                                logger.debug('Bot %s suggests move', self.name, vote);

                                socket.emit('new-move', vote);
                            }
                        }
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
        logger.debug('Bot %s disconnected', self.name);
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