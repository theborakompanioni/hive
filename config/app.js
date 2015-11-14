var nconf = require('nconf');

var env = process.env.NODE_ENV || 'development';
var file = __dirname + '/' + env + '.conf.json';

var config = nconf
    .argv()
    .env()
    .file({
        file: file
    });

module.exports = function () {
    return config;
};