var _ = require('lodash');

var util = require('./util');
var GameFactory = require('./games')();
var logger = require('./../setup/logging')({}).standard();


var Room = function (roomName, options) {
    var self = this;
    var _name = roomName || util.randomString(8);
    this.options = _.defaults(_.extend({}, options), {
        maxUsers: 1000,
        emitPlayerConnectEvents: false
    });
    this.game = null;
    this.players = [];

    this.name = function () {
        return _name;
    };

    var _socketId = this.name();
    this.socketId = function () {
        return _socketId;
    };

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
        logger.debug('create new game in room %s', this.name());

        if ('the-master-board' === this.name()) {
            this.game = GameFactory.createMultiplayerHiveChessGame(this, {
                autoRestart: true,
                restartTimeout: 10000,
                maxRounds: 600,
                destroyWhenLastPlayerLeft: false
            });
        } else {
            this.game = GameFactory.createMultiplayerHiveChessGame(this);
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

        logger.debug('player %s leaves room %s', player.name, this.name());

        var removedPlayers = _.remove(this.players, function (p) {
            return player.socket === p.socket;
        });

        if (this.options.emitPlayerConnectEvents) {
            _.forEach(removedPlayers, function (removedPlayer) {
                var leftRoomMsg = {
                    name: removedPlayer.name,
                    room: self.name(),
                    game: self.game.name()
                };

                removedPlayer.socket.broadcast.to(this.socketId()).emit('left-room', leftRoomMsg);
            }, this);
        }

        logger.debug('player %s left room %s', player.name, this.name());
    };

    this.addPlayer = function (player) {
        var socket = player.socket;
        if (this.players.length >= this.options.maxUsers) {
            logger.info('player %s cannot join full room %s', player.name, this.name());
            socket.emit('room-max-capacity-reached', {
                room: this.name()
            });
            return;
        }
        if (this.hasPlayer(player)) {
            logger.warn('player %s already joined room %s', player.name, this.name());
            return;
        }

        logger.debug('player %s joines room %s', player.name, this.name());

        this.players.push(player);

        var self = this;
        socket.on('disconnect', function (data) {
            self.removePlayer(player);
        });

        var game = this.getOrCreateGame();

        socket.join(this.socketId());

        var joinedRoomMsg = {
            name: player.name,
            room: this.name(),
            game: game.name()
        };

        socket.emit('self-joined-room', joinedRoomMsg);

        if (this.options.emitPlayerConnectEvents) {
            socket.broadcast.to(this.socketId()).emit('joined-room', joinedRoomMsg);
        }

        logger.debug('player %s joined room %s', player.name, this.name());

        game.addPlayer(player);
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
            throw new Error('Could not get room ' + name);
        }
        return room;
    };

    this.createRoom = function (name, config) {
        logger.debug('create new room %s', name);
        this.rooms[name] = new Room(name, config || {});
        return this.rooms[name];
    };

    this.removePlayer = function (roomName, player) {
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
    };
};

module.exports = function (options) {
    return {
        createRooms: function (options) {
            return new Rooms(options || {});
        }
    };
};