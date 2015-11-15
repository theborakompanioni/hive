var _ = require('lodash');

var util = require('./util');
var HiveChessGame = require('./game')().HiveChessGame();
var logger = require('./logging')({}).standard();

module.exports = function (options) {

    var Room = function (name, options) {
        this.name = name || util.randomString(8);
        this.options = _.defaults(_.extend({}, options), {
            maxUsers: 1000
        });
        this.game = null;
        this.players = [];

        this.hasGame = function () {
            return !!this.game;
        };

        this.getGameOrNull = function () {
            return this.game || null;
        };

        this.getOrCreateGame = function () {
            return this.hasGame() ? this.getGameOrNull() : this.createGame();
        };

        this.createGame = function () {
            logger.debug('create new game in room %s', this.name);

            if('the-master-board' === this.name) {
                this.game = new HiveChessGame(this.name, {
                    autoRestart: true,
                    restartTimeout: 10000,
                    maxRounds: 600,
                    destroyWhenLastPlayerLeft: false
                });
            } else {
                this.game = new HiveChessGame(this.name);
            }
            return this.game;
        };

        this.hasPlayer = function (player) {
            return !!_.findWhere(this.players, {
                socket: player.socket
            });
        };

        this.removePlayer = function (player) {
            if (this.hasGame()) {
                this.getGameOrNull().removePlayer(player);
            }

            logger.debug('player %s leaves room %s', player.name, this.name);

            var removedPlayers = _.remove(this.players, function (p) {
                return player.socket === p.socket;
            });

            _.forEach(removedPlayers, function (removedPlayer) {
                removedPlayer.socket.broadcast.to(this.name).emit('left-room');
            }, this);

            logger.debug('player %s left room %s', player.name, this.name);
        };

        this.addPlayer = function (player) {
            if (this.players.length >= this.options.maxUsers) {
                logger.info('player %s cannot join full room %s', player.name, this.name);
                return;
            }
            if (this.hasPlayer(player)) {
                logger.warn('player %s already joined room %s', player.name, this.name);
                return;
            }

            logger.debug('player %s joines room %s', player.name, this.name);
            var socket = player.socket;

            this.players.push(player);

            var self = this;
            socket.on('disconnect', function (data) {
                self.removePlayer(player);
            });

            socket.join(this.name);

            var joinedRoomMsg = {
                name: player.name,
                room: this.name
            };
            socket.broadcast.to(this.name).emit('joined-room', joinedRoomMsg);
            socket.emit('self-joined-room', joinedRoomMsg);

            logger.debug('player %s joined room %s', player.name, this.name);

            this.getOrCreateGame().addPlayer(player);
        };
    };

    var Rooms = function (options) {
        this.rooms = {};
        this.options = _.defaults(_.extend({}, options), {
            maxRoomCount: 1000
        });

        this.count = function () {
            return _.size(this.rooms);
        };

        this.hasRoom = function (name) {
            return !!this.rooms[name];
        };

        this.getRoomOrNull = function (name) {
            return this.rooms[name] || null;
        };

        this.createRoomIfAbsent = function (name) {
            return this.hasRoom(name) ? this.getRoomOrNull(name) : this.createRoom(name);
        };

        this.getRoom = function (name) {
            var room = this.getRoomOrNull(name);
            if (room === null) {
                throw new Error('No ');
            }
            return room;
        };

        this.createRoom = function (name) {
            logger.debug('create new room %s', this.name);
            this.rooms[name] = new Room(name);
            return this.rooms[name];
        };

        this.removePlayer = function(roomName, player) {
            var room = this.getRoomOrNull(roomName);
            if (room !== null) {
                room.removePlayer(player);
            }
        };

        this.onConnect = function (player) {
            logger.debug('player %s arrives', player.name);

            var rooms = this;
            player.socket.on('join-room', function (data) {
                var roomName = data.token;
                if (rooms.hasRoom(roomName)) {
                    rooms.getRoom(roomName).addPlayer(player);
                } else {
                    if (rooms.count() >= rooms.options.maxRoomCount) {
                        logger.warn('player %s declined: max room size %d reached', player.name, rooms.options.maxRoomCount);
                        return;
                    }
                    rooms.createRoomIfAbsent(roomName).addPlayer(player);
                }
            });

            player.socket.on('leave-room', function (data) {
                var roomName = data.token;
                rooms.removePlayer(roomName, player);
            });

            player.socket.on('disconnect', function (data) {
                var roomName = data.token;
                rooms.removePlayer(roomName, player);
            });
        }
    };

    return new Rooms(options);
};