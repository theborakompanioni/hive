var crypto = require('crypto');

var getMovesForStockfish = function (game) {
    var moves = '';
    var history = game.history({verbose: true});

    for (var i = 0; i < history.length; ++i) {
        var move = history[i];
        moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
};


var createStockfishPositionCommand = function (game) {
    var moves = getMovesForStockfish(game);
    return 'position startpos moves' + moves;
};


module.exports = {
    createStockfishPositionCommand: createStockfishPositionCommand,
    encrypt: function (plainText) {
        return crypto.createHash('md5').update(plainText).digest('hex');
    },

    randomString: function (length) {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz';
        var string = '';
        for (var i = 0; i < length; i++) {
            var randomNumber = Math.floor(Math.random() * chars.length);
            string += chars.substring(randomNumber, randomNumber + 1);
        }

        return string;
    }
};