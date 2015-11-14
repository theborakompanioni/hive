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

var logger = require('./config/logging')().standard();

var env = process.env.NODE_ENV || 'default';
var DEFAULT_PORT = 3000;

var conf = require('./config/app')();

var app = express();

// configure database
require('./config/database')(app, mongoose);
require('./config/morgan')(app, __dirname + '/logs', env === 'development' ? 'dev' : 'combined');

// bootstrap data models
fs.readdirSync(__dirname + '/models').forEach(function (file) {
    if (~file.indexOf('.js')) require(__dirname + '/models/' + file);
});

// configure express app
app.set('port', process.env.PORT || conf.get('app:port') || DEFAULT_PORT);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(compression());
app.use(favicon(__dirname + '/client/apps/chesshive/dist/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser('S3CRE7'));
app.use(flash());
app.use(session({secret: 'S3CRE7-S3SSI0N', saveUninitialized: true, resave: true}));
app.use(express.static(path.join(__dirname, 'client/apps/chesshive/dist')));

require('./config/passport')(app, passport);
app.use(passport.initialize());
app.use(passport.session());

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
require('./config/errorHandlers.js')(app);

var appName = conf.get('app:name') || 'unnamed';

// launch app server
var server = require('http').createServer(app).listen(app.get('port'), function () {
    logger.info('Application %s started on port %d', appName, server.address().port);
});

require('./config/socket.js')(server);

module.exports = app;
