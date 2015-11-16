
var logger = require('./../setup/logging')({}).standard();

var MultiplayerHiveChessGameFactory = require('./game/MultiplayerHiveChessGame')();

module.exports = function () {
    return {
        createMultiplayerHiveChessGame: function (room, config) {
            return MultiplayerHiveChessGameFactory.create(room, config);
        }
    };
};