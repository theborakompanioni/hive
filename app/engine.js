var Q = require("q");

function getMovesForStockfish(game) {
    var moves = '';
    var history = game.history({verbose: true});

    for (var i = 0; i < history.length; ++i) {
        var move = history[i];
        moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
}

module.exports = function () {
    var stockfish = require('stockfish');
    var engine = stockfish();
    var bestMoveReceived = false;
    var currentBestMove = null;
    var deferred = null;

    engine.onmessage = function (event) {
        var line;

        if (event && typeof event === 'object') {
            line = event.data;
        } else {
            line = event;
        }

        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbk])?/);

        /// Did the AI move?
        if (match) {
            console.log('STOCKFISH SAYS BEST MOVE IS from %s to %s promotion', match[1], match[2], match[3]);

            currentBestMove = {
                from: match[1],
                to: match[2],
                promotion: match[3]
            };
            bestMoveReceived = true;
            //deferred.resolve(currentBestMove);
        }
    };

    return {
        waitForBestMove: function () {
            /*if (deferred === null) {
                var d = Q.defer();
                d.reject();
                return d.promise;
            }

            return deferred.promise;*/
            return currentBestMove;
        },
        updateGame: function (game) {
            bestMoveReceived = false;
            //deferred = Q.defer(); // create promise which will resolve if move IA has best move

            var moves = getMovesForStockfish(game);

            engine.postMessage('position startpos moves' + moves);
            engine.postMessage('go depth 13');
        }
    };
};