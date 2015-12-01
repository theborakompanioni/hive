var fs = require('fs');
var express = require('express');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');
var compression = require('compression');

var conf = require('./config/app')().get('app');
var logger = require('./setup/logging')().standard();

var DEFAULT_PORT = 3000;

var app = express();

// configure database
require('./setup/morgan')(app, conf.morgan);
require('./setup/database')(app, conf.mongo);

// bootstrap data models
fs.readdirSync(__dirname + '/models').forEach(function (file) {
    if (~file.indexOf('.js')) require(__dirname + '/models/' + file);
});

// configure express app
app.set('port', process.env.PORT || conf.port || DEFAULT_PORT);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(compression());
app.use(favicon(__dirname + '/client/apps/chesshive/dist/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser('S3CRE7'));
app.use(flash());
//app.use(session({secret: 'S3CRE7-S3SSI0N', saveUninitialized: true, resave: true}));
app.use(express.static(path.join(__dirname, 'client/apps/chesshive/dist')));

require('./setup/passport')(app, passport);

// configure routes
var routes = require('./routes/index');
var account = require('./routes/account');
var api = require('./routes/api');
var play = require('./routes/play');
var login = require('./routes/login');
var register = require('./routes/register');
var search = require('./routes/search');

app.use('/', routes);
app.use('/login', login);
app.use('/register', register);
app.use('/account', account);
app.use('/play', play);
app.use('/api', api);
app.use('/search', search);

// configure error handlers
require('./setup/errorHandlers')(app);

var appName = conf.name || 'unnamed';

// launch app server
var server = require('http').createServer(app).listen(app.get('port'), function () {
    logger.info('Application %s started on port %d', appName, server.address().port);
});

require('./setup/socket')(server);

require('./setup/bots')('the-master-board', {
    amount: 2,
    bots: {
        autoReconnect: false
    }
});

setTimeout(function () {
    require('./setup/bots')('the-master-board', {
        amount: 15,
        bots: {
            autoReconnect: {
                reconnectTimeout: function () {
                    var minSeconds = 30;
                    var minutes = 10;
                    return minSeconds * 1000 + minutes * Math.floor(Math.random() * 60 * 1000);
                },
                disconnectTimeout: function () {
                    var minSeconds = 30;
                    var minutes = 30;
                    return minSeconds * 1000 + minutes * Math.floor(Math.random() * 60 * 1000);
                }
            }
        }
    });
}, 2000);

module.exports = app;
