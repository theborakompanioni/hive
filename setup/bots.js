var _ = require('lodash');
var botsFactory = require('./../app/bots')({});
var logger = require('./../setup/logging')({}).standard();

module.exports = function (options) {
    var settings = _.defaults(_.extend({}, options), {
        amount: 10
    });
    var roomName = 'the-master-board';

    var wait = 500;

    setTimeout(function () {
        logger.debug('add bot to room %s', roomName);
        var bot = botsFactory.createBot(roomName, {
            moveSettingsSupplier: function () {
                return {
                    nodes: 1
                };
            }
        });
    }, wait + 10);

    setTimeout(function () {
        logger.debug('add bot to room %s', roomName);
        var bot = botsFactory.createBot(roomName, {
            moveSettingsSupplier: function () {
                return {
                    depth: 1
                };
            }
        });
    }, wait + 20);

    for (var i = 2; i < settings.amount; i++) {
        setTimeout(function () {
            logger.debug('add bot to room %s', roomName);
            var bot = botsFactory.createBot(roomName, {});
        }, (i + 1) * wait);
    }

};