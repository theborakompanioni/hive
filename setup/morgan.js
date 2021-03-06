var fs = require('fs');
var path = require('path');
var FileStreamRotator = require('file-stream-rotator');
var morgan = require('morgan'); // http request logger middleware

module.exports = function (app, conf) {
    // ensure log directory exists
    fs.existsSync(conf.dir) || fs.mkdirSync(conf.dir);

    // create a rotating write stream
    var accessLogStream = FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: path.join(conf.dir, 'access-%DATE%.log'),
        frequency: 'daily',
        verbose: false
    });

    app.use(morgan(conf.format || 'dev', {
        stream: accessLogStream
    }));
};