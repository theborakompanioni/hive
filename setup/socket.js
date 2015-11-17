var _ = require('lodash');
var chess = require('chess.js');
var roomsFactory = require('./../app/rooms')({});
var playersFactory = require('./../app/players')({});
var logger = require('./logging')({}).standard();

module.exports = function (server) {
    var io = require('socket.io').listen(server);

    var rooms = roomsFactory.createRooms();

    io.sockets.on('connection', function (socket) {
        var username = socket.handshake.query.user;
        logger.debug('socket connection established with user ' + username);

        var player = playersFactory.createPlayer(username, socket);

        rooms.onConnect(player);
    });
};