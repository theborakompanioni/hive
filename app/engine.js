var Q = require('q');
var _ = require('lodash');
var stockfish = require('stockfish');
var util = require('./util');

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


module.exports = function (settings) {
    // http://support.stockfishchess.org/kb/advanced-topics/engine-parameters
    var options = _.defaults(_.extend({}, settings), {
        contemptFactor: 0, // -100 - 100
        skillLevel: 10, // 0 - 20,
        kingSafety: 0
    });

    var engine = stockfish();

    var engineContext = {
        bestMove: null,
        bestMoveReceived: false,
        score: null,
        scoreReveiced: false
    };

    var resetEngineContext = function () {
        engineContext = {
            bestMove: null,
            bestMoveReceived: false,
            score: null,
            scoreReveiced: false
        };
    };

    engine.onmessage = function (event) {
        var line;

        if (event && typeof event === 'object') {
            line = event.data;
        } else {
            line = event;
        }

        var matchBestMoveMessage = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbk])?/);
        if (matchBestMoveMessage) {
            engineContext.bestMove = {
                from: matchBestMoveMessage[1],
                to: matchBestMoveMessage[2],
                promotion: matchBestMoveMessage[3]
            };
            engineContext.bestMoveReceived = true;
        }

        var matchScoreMessage = line.match(/^info .*\bscore (\w+) (-?\d+)/);
        if (matchScoreMessage) {
            var score = parseInt(matchScoreMessage[2]); // * (game.turn() == 'w' ? 1 : -1);
            var centipawns = matchScoreMessage[1] === 'cp';
            var foundMate = matchScoreMessage[1] === 'mate';
            if (centipawns) {
                engineContext.score = (score / 100.0).toFixed(2);
            } else if (foundMate) {
                engineContext.score = 'Mate in ' + Math.abs(score);
            }
            /*var isScoreBounded = line.match(/\b(upper|lower)bound\b/)
             if(isScoreBounded) {
             engineContext.score = ((isScoreBounded[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineContext.score
             }*/
        }
    };

    engine.postMessage('uci');

    engine.postMessage('setoption name Contempt value ' + options.contemptFactor);
    engine.postMessage('setoption name Skill Level value ' + options.skillLevel);
    engine.postMessage('setoption name King Safety value value ' + options.kingSafety);

    return {
        newGame: function () {
            engine.postMessage('ucinewgame');
        },
        getForBestMoveOrNull: function () {
            if (!engineContext.bestMoveReceived) {
                return null;
            }

            return engineContext.bestMove;
        },
        startSearchForBestMove: function (game, options) {
            resetEngineContext();

            var goCommandOptions = _.defaults(_.extend({}, options), {
                depth: 5
            });
            //deferred = Q.defer(); // create promise which will resolve if move IA has best move

            var positionCommand = util.createStockfishPositionCommand(game);
            engine.postMessage(positionCommand);

            var goCommand = createStockfishGoCommand(goCommandOptions);
            engine.postMessage(goCommand);
        }
    };
};