var _ = require('lodash');
var botsFactory = require('./../app/bots')({});
var logger = require('./../setup/logging')({}).standard();

module.exports = function (roomName, options) {
    var settings = _.defaults(_.extend({}, options), {
        amount: 2,
        bots: {}
    });

    var wait = 500;

    for (var i = 0; i < settings.amount; i++) {
        setTimeout(function () {
            logger.debug('add bot to room %s', roomName);
            var bot = botsFactory.createBot(roomName, settings.bots);
        }, (i + 1) * wait);
    }
};