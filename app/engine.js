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

var newEngine = function () {
    var engine = stockfish();

    return {
        ucinewgame: function () {
            engine.postMessage('ucinewgame');
        }
    };
};


var createAnalyticsEngine = function () {
    var onMessageHandler = [];
    var onMessage = function (message) {
        onMessageHandler.forEach(function (handler) {
            handler(message);
        });
    };

    var engine = stockfish();

    engine.onmessage = function (event) {
        var line;

        if (event && typeof event === 'object') {
            line = event.data;
        } else {
            line = event;
        }
        onMessage(line);
    };

    var onTotalEvaluationMessage = (function () {
        // message e.g.: -> Total Evaluation: -0.07 (white side)
        var totalEvaluationRegex = /^Total Evaluation:\s(-?\d+\.?\d+)[\s\S]+$/;
        return function (message, callback) {
            if (message && message.charAt(0) === 'T' && totalEvaluationRegex.test(message)) {
                var score = parseFloat(message.match(totalEvaluationRegex)[1]);
                return callback(score);
            }
        };
    })();

    var registerOnMessageHandler = function (callback) {
        onMessageHandler.push(callback);
        return function () {
            // TODO: remove message handler
            return false;
        };
    };


    engine.postMessage('uci');

    return {
        ucinewgame: function () {
            engine.postMessage('ucinewgame');
        },
        analyze: function (chessjsGameInstance) {
            var positionCommand = createStockfishPositionCommand(chessjsGameInstance);

            engine.postMessage(positionCommand);
            engine.postMessage('eval');
        },
        _postMessage: function (message) {
            engine.postMessage(message);
        },
        onMessage: function (callback) {
            return registerOnMessageHandler(callback);
        },
        onTotalEvaluation: function (callback) {
            return registerOnMessageHandler(function (message) {
                onTotalEvaluationMessage(message, callback);
            });
        }
    };
};

var createPlayerEngine = function (settings) {
    // http://support.stockfishchess.org/kb/advanced-topics/engine-parameters
    var options = _.defaults(_.extend({}, settings), {
        contemptFactor: 0, // -100 - 100
        skillLevel: 10, // 0 - 20,
        kingSafety: 0
    });

    var engine = createAnalyticsEngine();

    var engineContext = {
        move: {
            bestMove: null,
            moveScore: null,
        },
        whiteOverallScore: null
    };

    var resetMoveContext = function () {
        engineContext.move = {
            bestMove: null,
            moveScore: null,
        };
    };

    engine.onTotalEvaluation(function (scoreForWhite) {
        engineContext.totalEvaluationWhite = scoreForWhite;
    });

    engine.onMessage(function (line) {
        var matchBestMoveMessage = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbk])?/);
        if (matchBestMoveMessage) {
            engineContext.move.bestMove = {
                from: matchBestMoveMessage[1],
                to: matchBestMoveMessage[2],
                promotion: matchBestMoveMessage[3]
            };
        }

        var matchScoreMessage = line.match(/^info .*\bscore (\w+) (-?\d+)/);
        if (matchScoreMessage) {
            var score = parseInt(matchScoreMessage[2]); // * (game.turn() == 'w' ? 1 : -1);
            var centipawns = matchScoreMessage[1] === 'cp';
            var foundMate = matchScoreMessage[1] === 'mate';
            if (centipawns) {
                engineContext.move.moveScore = (score / 100.0).toFixed(2);
            } else if (foundMate) {
                engineContext.move.moveScore = 'Mate in ' + Math.abs(score);
            }
            /*var isScoreBounded = line.match(/\b(upper|lower)bound\b/)
             if(isScoreBounded) {
             engineContext.score = ((isScoreBounded[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineContext.score
             }*/
        }
    });


    engine._postMessage('setoption name Contempt value ' + options.contemptFactor);
    engine._postMessage('setoption name Skill Level value ' + options.skillLevel);
    engine._postMessage('setoption name King Safety value ' + options.kingSafety);

    return {
        newGame: function () {

            engineContext.whiteOverallScore = null;
            resetMoveContext();
            engine.ucinewgame();
        },
        analyze: function(game) {
            engine.analyze(game);
        },
        getTotalEvaluationForColorOrNull: function () {
            return engineContext.totalEvaluationWhite;
        },
        getBestMoveOrNull: function () {
            return engineContext.move.bestMove;
        },
        startSearchForBestMove: function (game, options) {
            resetMoveContext();

            var goCommandOptions = _.defaults(_.extend({}, options), {
                depth: 5
            });
            //deferred = Q.defer(); // create promise which will resolve if move IA has best move

            var positionCommand = createStockfishPositionCommand(game);
            engine._postMessage(positionCommand);

            var goCommand = createStockfishGoCommand(goCommandOptions);
            engine._postMessage(goCommand);
        }
    };
};


module.exports = {
    PlayerEngine: createPlayerEngine,
    AnalyticsEngine: createAnalyticsEngine
};