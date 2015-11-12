var fs = require('fs');
var FileStreamRotator = require('file-stream-rotator');
var morgan = require('morgan'); // http request logger middleware

module.exports = function (app, logDirectory, format) {
    // ensure log directory exists
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

    // create a rotating write stream
    var accessLogStream = FileStreamRotator.getStream({
        filename: logDirectory + '/access-%DATE%.log',
        frequency: 'daily',
        verbose: false
    });
    app.use(morgan(format || 'dev', {
        stream: accessLogStream
    }));
};