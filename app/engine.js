var Q = require('q');
var _ = require('lodash');
var stockfish = require('stockfish');

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

var createStockfishGoCommand = function (settings) {
    if (settings) {
        if (settings.depth) {
            return 'go depth ' + settings.depth;
        } else if (settings.nodes) {
            return 'go nodes ' + settings.nodes;
        } else if (settings.wtime && settings.winc && settings.btime && settings.binc) {
            return 'go wtime ' + settings.wtime + ' winc ' + settings.winc + ' btime ' + settings.btime + ' binc ' + settings.binc;
        } else if (settings.movetime) {
            return 'go movetime ' + settings.movetime;
        }
    }

    return 'go';
};


module.exports = function () {
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
        getForBestMoveOrNull: function () {
            if (!bestMoveReceived) {
                return null;
            }

            return currentBestMove;
        },
        startSearchForBestMove: function (game, options) {
            var goCommandOptions = _.defaults(_.extend({}, options), {
                depth: 5
            });
            bestMoveReceived = false;
            currentBestMove = null;
            //deferred = Q.defer(); // create promise which will resolve if move IA has best move

            var positionCommand = createStockfishPositionCommand(game);
            engine.postMessage(positionCommand);
            var goCommand = createStockfishGoCommand(goCommandOptions);
            engine.postMessage(goCommand);
        }
    };
};