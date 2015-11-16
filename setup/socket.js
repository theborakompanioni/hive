var _ = require('lodash');
var chess = require('chess.js');
var rooms = require('./../app/rooms')({});
var logger = require('./logging')({}).standard();

module.exports = function (server) {
    var io = require('socket.io').listen(server);

    io.sockets.on('connection', function (socket) {
        var username = socket.handshake.query.user;
        logger.debug('socket connection established with user ' + username);

        var player = {
            socket: socket,
            name: username
        };

        rooms.onConnect(player);
    });
};