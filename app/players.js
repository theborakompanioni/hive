var _ = require('lodash');

var util = require('./util');
var GameFactory = require('./games')();
var logger = require('./../setup/logging')({}).standard();

var Player = function (name, socket, options) {
    this.name = name || util.randomString(8);
    this.socket = socket;
    this.options = _.defaults(_.extend({}, options), {});
};

module.exports = function () {
    return {
        createPlayer: function (name, socket, options) {
            return new Player(name, socket, options || {});
        }
    };
};