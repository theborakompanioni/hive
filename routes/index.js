var express = require('express');
var util = require('../app/util.js');

var router = express.Router();

router.get('/', function (req, res) {
    res.render('partials/index', {
        title: 'Chess Hive'
    });
});

router.get('/test', function (req, res) {
    res.render('partials/index', {
        title: 'Chess Hive - Test'
    });
});

module.exports = router;
