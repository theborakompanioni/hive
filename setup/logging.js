var winston = require('winston');
var conf = require('./../config/app')().get('app');

winston.emitErrs = true;

var standardLogger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: conf.logging.file.level,
            filename: './logs/application.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 10,
            colorize: false
        }),
        new winston.transports.Console({
            level: conf.logging.console.level,
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

module.exports = function () {
    return {
        standard: function () {
            return standardLogger;
        }
    }
};
