var _ = require('lodash');
var botsFactory = require('./../app/bots')({});
var logger = require('./../setup/logging')({}).standard();

module.exports = function (options) {

    var roomName = 'the-master-board';
    var firstBot = null;

    setTimeout(function () {
        logger.debug('add bot to room %s', roomName);
        firstBot = botsFactory.createBot(roomName, {});
    }, 2000);
};