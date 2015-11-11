var fs = require('fs');
var mongoose = require('mongoose');
var config = require('config');
mongoose.connect(config.get('chesshive.db'));
//mongoose.connect('mongodb://localhost/test');

fs.readdirSync(__dirname + '/models').forEach(function (file) {
    if (~file.indexOf('.js')) require(__dirname + '/models/' + file);
});

var User = mongoose.model('User');
var Game = mongoose.model('Game');

var u = new User({ name: 'Foo', email: 'foo@bar.org', lastConnection: 'Sun Nov 02 2014 11:16:56 GMT+0100 (CET)', password: '3858f62230ac3c915f300c664312c63f' });
u.save(function(err) {});

User.findOne({email: 'foo@bar.org'} ,function (err, user) {
    var fooId = user.id;
    var g1 = new Game({
        user: fooId,
        white: "Foo",
        black: "Anonymous",
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O Bc5 5. c3 O-O 6. d4 exd4 7. cxd4 Bb4",
        result: "1-0"});

    var g2 = new Game({
        user: fooId,
        white: "Foo",
        black: "Anonymous",
        pgn: "1. e4 c6 2. e5 d5 3. exd6 exd6 4. Nf3 Bg4 5. d4 Nf6 6. Bg5 Be7",
        result: "1-0"});

    g1.save(function(err) {});
    g2.save(function(err) {});

    mongoose.connection.close();
});

/* Init elastic search server */

var elasticsearch = require('elasticsearch');
var connectionString = "http://"+config.get('chesshive.es.host')+":"+config.get('chesshive.es.port');
var client = new elasticsearch.Client({
host: connectionString,
log: 'trace'
});
client.ping({
    requestTimeout: 5000
}, function (error) {
    if (error) {
        console.error('elasticsearch is down!');
    } else {
        console.log('elasticsearch is up and running!');
    }
});


client.indices.create({
    index: 'chesshive'
}, function() {
    client.create({
        index: 'chesshive',
        type: 'game',
        id: '1',
        body: {
            white: "Foo",
            black: "Anonymous",
            content: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O Bc5 5. c3 O-O 6. d4 exd4 7. cxd4 Bb4",
            result: "1-0"
        }
    }, function(){
        client.create({
            index: 'chesshive',
            type: 'game',
            id: '2',
            body: {
                white: "Anonymous",
                black: "Bar",
                content: "1. e4 c6 2. e5 d5 3. exd6 exd6 4. Nf3 Bg4 5. d4 Nf6 6. Bg5 Be7",
                result: "1-0"
            }
        }, function() {
            client.close();
        });
    });
});


