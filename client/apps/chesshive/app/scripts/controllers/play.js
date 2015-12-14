'use strict';

/**
 * @ngdoc function
 * @name chesshiveApp.controller:PlayCtrl
 * @description
 * # PlayCtrl
 * Controller of the chesshiveApp
 */
angular.module('chesshiveApp')
  .controller('PlayCtrl', function () {

  })

  .directive('chesshiveGameOverMessage', function () {
    /*
     { "winner": "white", "inDraw": false, "restarts": true, "restartTimeout": 10000, "restartTime": 1448401755116, "now": 1448401745116 }
     */
    return {
      scope: {},
      template: '<div class="panel panel-default" data-ng-show="model.gameOver">' +
      ' <div class="panel-heading">' +
      '  <p style="margin-top:13px;">' +
      '   <span data-ng-show="model.inDraw">Game over. Game ended in a<strong> a draw</strong>.</span>' +
      '   <span data-ng-hide="model.inDraw">' +
      '    <img data-ng-src="{{model.winnerImageSrc}}" style="height:32px; margin-top:-7px;"/>' +
      '    Game over. <strong>{{gameOverData.winner | firstCharUppercase }}</strong> won.' +
      '   </span>' +
      '  </p>' +
      ' </div>' +
      ' <div class="panel-body">' +
      '  <h3>Game over.</h3>' +
      '  <span data-ng-show="gameOverData.restarts">' +
      '   A new game will start shortly.' +
      '  </span>' +
      '  <div data-ng-if="gameOverData.restarts" ' +
      '    data-chesshive-countdown ' +
      '    data-time="model.countdown"' +
      '    data-show-progress-bar="true"' +
      '   ></div>' +
      ' </div>' +
      ' <div class="panel-footer">' +
      ' </div>' +
      '</div>',
      controller: function ($scope, $timeout, HiveChessService) {
        $scope.model = {
          gameOver: false
        };

        HiveChessService.socket().forward('game-over', $scope);
        $scope.$on('socket:game-over', function (event, data) {
          onGameOver(data);
        });

        HiveChessService.socket().forward('new-top-rated-game-move', $scope);
        $scope.$on('socket:new-top-rated-game-move', function (event, data) {
          $scope.model.gameOver = data.gameOver;
          $scope.model.inDraw = data.inDraw;
          $scope.gameOverData = {};
        });

        function onGameOver(data) {
          $scope.gameOverData = data;
          $scope.model.gameOver = data.gameOver;
          $scope.model.inDraw = data.inDraw;

          $scope.model.winnerImageSrc = data.inDraw ? '' : HiveChessService.createImageSource(data.winner.charAt(0) + 'K');

          if ($scope.gameOverData.restarts) {
            $scope.model.countdown = $scope.gameOverData.restartTimeout;
          }
        }
      }
    };
  })
  .directive('chesshivePlayerStats', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<ul class="list-unstyled">' +
      '<li><i class="fa fa-circle-o"></i> White: {{ playerStats.white | number:0 }}</li>' +
      '<li><i class="fa fa-circle"></i> Black: {{ playerStats.black | number:0 }}</li>' +
      '</ul>',
      controller: function ($scope) {
        $scope.playerStats = {};

        chessHiveGameSocket.forward('player-stats', $scope);
        $scope.$on('socket:player-stats', function (event, data) {
          $scope.playerStats = data;
        });
      }
    };
  })

  .directive('chesshiveSuggestedMoves', function ($rootScope, $timeout, chessHiveGameSocket) {
    return {
      scope: {
        isInTurn: '='
      },
      template: '<div data-ng-switch data-on="movesHaveBeenSuggested">' +
      '<h4>Suggestions</h4>' +
      '<div data-ng-switch-when="false">' +
      ' <p>No move suggestions yet.</p>' +
      ' <div class="alert bg-primary" data-ng-show="isInTurn">' +
      '  <div class="row vertical-align">' +
      '   <div class="col-xs-3">' +
      '    <span class="fa fa-exclamation-triangle fa-2x"></span>' +
      '   </div>' +
      '   <div class="col-xs-9">' +
      '    Be the first to suggest the next move!' +
      '   </div>' +
      '  </div>' +
      ' </div>' +
      '</div>' +
      '<div data-ng-switch-when="true">' +
      ' <table class="table table-bordered table-condensed table-striped table-hover">' +
      '  <tr data-ng-repeat="move in suggestedMoves | orderBy:\'value\':true">' +
      '   <td>' +
      '    <img data-ng-if="move.image" ' +
      '         data-ng-src="images/chesspieces/wikipedia/{{move.image}}" ' +
      '         style="height:20px;" alt="{{move.image}}"/>' +
      '    <span class="badge badge-default">{{move.key}}</span>' +
      '    <button class="btn btn-default btn-xs pull-right" ' +
      '       data-ng-click="voteForMove(move.move)" ' +
      '       data-ng-show="!model.voted">' +
      '      <i class="fa fa-check"></i>' +
      '    </button>' +
      '   </td>' +
      '   <td class="text-right"> {{ move.value | number:0 }} </td>' +
      '  </tr>' +
      ' </table>' +
      '</div>' +
      '</div>',
      controller: function ($scope) {
        $scope.model = {
          voted: false
        };
        $scope.movesHaveBeenSuggested = false;
        $scope.suggestedMoves = null;

        chessHiveGameSocket.forward('suggested-moves', $scope);
        $scope.$on('socket:suggested-moves', function (event, data) {
          if (data.team) {
            $scope.movesHaveBeenSuggested = _.keys(data.team).length > 0;
            $scope.suggestedMoves = [];
            angular.forEach(data.team, function (move, key) {
              var possiblePeace = key && key.charAt(0);
              var hasImage = possiblePeace === 'B' ||
                possiblePeace === 'N' ||
                possiblePeace === 'R' ||
                possiblePeace === 'K' ||
                possiblePeace === 'Q';
              var image = !hasImage ? null : (move.color.charAt(0) + possiblePeace + '.png');

              $scope.suggestedMoves.push({
                key: key,
                value: move.value,
                image: image,
                move: move
              });
            });
          }
        });

        chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
        $scope.$on('socket:new-top-rated-game-move', function () {
          $scope.suggestedMoves = null;
          $scope.movesHaveBeenSuggested = false;
          $scope.model.voted = false;
        });

        $scope.voteForMove = function (suggestedMove) {
          $scope.model.voted = true;
          $rootScope.$broadcast('chesshive:vote-for-suggested-move', suggestedMove);
        };

        $scope.$on('chesshive:new-move', function () {
          $scope.model.voted = true;
        });
      }
    };
  })
  .directive('chesshiveCountdown', function ($timeout) {
    return {
      scope: {
        time: '=',
        max: '=',
        showProgressBar: '=',
        progressBarColor: '=',
        showText: '='
      },
      template: '<div data-ng-show="countdown >= 0">' +
      ' <span data-ng-show="showText">{{countdown / 1000 | number:precision}}s</span>' +
      ' <div class="progress" data-ng-show="showProgressBar" style="border-radius: 0; height: 5px; margin-bottom: 0;">' +
      '  <div class="progress-bar progress-bar-striped active" ' +
      '    role="progressbar" aria-valuenow="{{countdown}}" aria-valuemin="0" aria-valuemax="{{timeLengthInMs}}" ' +
      '    style="width: {{ percentage | number:0 }}%">' +
      '   <span class="sr-only">{{ percentage | number:0 }}% Complete</span>' +
      '  </div>' +
      ' </div>' +
      '</div>',
      controller: function ($scope) {
        $scope.showText = $scope.showText !== false;
        $scope.showProgressBar = $scope.showProgressBar !== false;
        $scope.fullSecond = 0;
        $scope.precision = 0;
        $scope.percentage = 0;
        $scope.countdown = 0;
        $scope.max = 0;

        var cancelTimeout = angular.noop;

        var updateCountDownTimer = function () {
          cancelTimeout();

          var nextTimerUpdate = 100;
          $scope.countdown = $scope.initTime - Date.now();
          if ($scope.countdown <= 0) {
            $scope.countdown = 0;
          } else {
            $scope.precision = 0;

            $scope.fullSecond = Math.floor($scope.countdown / 1000);
            $scope.percentage = $scope.countdown / $scope.max * 100;

            if ($scope.countdown <= 11000) {
              nextTimerUpdate = 10;
            }
            if ($scope.countdown < 10000) {
              $scope.precision = 1;
            }

            var offset = ($scope.countdown - ($scope.fullSecond * 1000));
            nextTimerUpdate = nextTimerUpdate - offset;
          }

          var timeoutId = $timeout(updateCountDownTimer, nextTimerUpdate);
          cancelTimeout = function () {
            $timeout.cancel(timeoutId);
            cancelTimeout = angular.noop;
          };
          return cancelTimeout;
        };

        $scope.$watch('time', function (newValue) {
          if (newValue) {
            $scope.max = newValue;
            $scope.initTime = newValue + Date.now();
            updateCountDownTimer();
          }
        });

        $scope.$on('$destroy', function () {
          cancelTimeout();
        });
      }
    };
  })
  .directive('chesshiveTimeToNextDigest', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {
        showProgressBar: '=',
        showText: '='
      },
      template: '<div>' +
      ' <div data-ng-show="!gameOver">' +
      ' <div data-chesshive-countdown ' +
      '  data-time="model.countdown"' +
      '  data-show-progress-bar="showProgressBar" ' +
      '  data-show-text="showText"' +
      ' ></div>' +
      '</div>',
      controller: function ($scope, $timeout) {
        $scope.model = {};
        chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
        $scope.$on('socket:new-top-rated-game-move', function (event, data) {
          $scope.data = data;
          $scope.gameOver = data.gameOver;
          $scope.model.countdown = 0;
          $timeout(function () {
            $scope.model.countdown = data.nextDigest;
          }, 1);
        });
      }
    };
  })
  .factory('HiveChessService', function (chessHiveGameSocket, nywtonChessboardConfig) {

    return {
      socket: function () {
        return chessHiveGameSocket;
      },
      createImageSource: function (piece) {
        return nywtonChessboardConfig.pieceTheme.replace('{piece}', piece);
      }
    };
  })

/**
 * @ngdoc function
 * @name chesshiveApp.controller:HiveGameCtrl
 * @description
 * # HiveGameCtrl
 * Controller of the chesshiveApp
 */
  .controller('HiveChessGameCtrl', function ($rootScope, $scope, $timeout, HiveChessService) {
    var chessHiveGameSocket = HiveChessService.socket();
    /*
     * Initialize a new game
     */
    $scope.board = null; // will be created by angular-chessboard
    var game = new Chess();
    var token = 'the-master-board';

    $scope.model = {
      joined: false,
      turn: null,
      voted: false,
      vote: null,
      color: null,
      gameOver: false,
      orientation: 'white',
      gameHistoryString: '',
      pieceImageSrc: null
    };

    /*
     * When a piece is dragged, check if it the current player has the turn
     */
    $scope.onDragStart = function (source, piece/*, position, orientation*/) {
      if (!$scope.model.joined) {
        return false;
      }

      if (game.gameOver() === true ||
        (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
        (game.turn() !== $scope.model.color.charAt(0) )) {
        console.log('[debug] onDragStart abort');
        return false;
      }
    };

    /*
     * When a piece is dropped, check if the move is legal
     */
    $scope.onDrop = function (source, target/*, piece, newPos, oldPos, orientation*/) {
      var color = game.turn() === 'b' ? 'black' : 'white';
      // see if the move is legal
      var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for simplicity
      });

      // illegal move
      if (move === null) {
        console.log('[debug] onDrop - illegal move');
        return 'snapback';
      }

      suggestMove(color, move.san, source, target);
    };

    var suggestMove = function (color, san, source, target) {
      if (!$scope.model.voted) {
        $scope.model.voted = true;

        var vote = {
          token: token,
          turn: color,
          resign: false,
          move: {
            san: san,
            source: source,
            target: target
          }
        };

        $scope.model.vote = vote.move;

        chessHiveGameSocket.emit('new-move', vote);
        $rootScope.$broadcast('chesshive:new-move', vote);

        Messenger().post({
          message: 'Your move has been suggested: ' + source + ' -> ' + target,
          type: 'success',
          showCloseButton: true,
          hideAfter: 3
        });
      }
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    $scope.onSnapEnd = function () {
      $scope.board.position(game.fen());
    };

    chessHiveGameSocket.forward('player-connected', $scope);
    $scope.$on('socket:player-connected', function (event, data) {
      console.log('[debug] socket:player-connected: ' + JSON.stringify(data));
    });

    chessHiveGameSocket.forward('self-player-connected', $scope);
    $scope.$on('socket:self-player-connected', function (event, data) {
      console.log('[debug] socket:self-connected: ' + JSON.stringify(data));
      var color = data.side;

      $scope.model.joined = true;
      $scope.model.orientation = color;
      $scope.model.color = color;
      $scope.model.pieceImageSrc = HiveChessService.createImageSource(color.charAt(0) + 'K'); //'images/chesspieces/wikipedia/' + color.charAt(0) + 'K.png';

      $scope.board.orientation(color);
    });

    var isInTurn = function () {
      return !$scope.model.gameOver && $scope.model.joined && game.turn() === $scope.model.color.charAt(0);
    };

    chessHiveGameSocket.forward('game-over', $scope);
    $scope.$on('socket:game-over', function (event, data) {
      $scope.model.gameOver = data.gameOver;
      $scope.model.isInTurn = false;
      $scope.model.voted = false;
      $scope.model.vote = null;
    });

    /*
     * A new move has been chosen by the server => update the UI with the move
     */
    chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
    $scope.$on('socket:new-top-rated-game-move', function (event, data) {
      console.log('[debug] socket:new-top-rated-move: ' + JSON.stringify(data));

      $scope.model.gameOver = data.gameOver;

      game.loadPgn(data.pgn);

      $scope.board.position(data.fen);

      $scope.model.gameHistoryString = game.pgn();
      $scope.model.turn = game.turn();
      $scope.model.isInTurn = isInTurn();
      $scope.model.vote = null;
      $scope.model.voted = false;

      var moveOrNull = data.move;
      if (moveOrNull) {
        var color = moveOrNull.color === 'b' ? 'black' : 'white';
        Messenger().post({
          message: color + ' agreed on ' + moveOrNull.san +
          (moveOrNull.__debug_random ? ' (r) ' : ''),
          type: 'info',
          showCloseButton: true,
          hideAfter: 3
        });
      }
    });

    $scope.voteForResignation = function () {
      if ($scope.model.joined === true && !$scope.model.voted) {
        var color = game.turn() === 'b' ? 'black' : 'white';
        var vote = {
          token: token,
          turn: color,
          resign: true,
          move: null
        };
        chessHiveGameSocket.emit('new-move', vote);

        $scope.model.voted = true;
        $scope.model.vote = 'resign';
      }
    };

    /*
     * Notify opponent resignation
     */
    chessHiveGameSocket.on('player-resigned', function (data) {
      console.log('[debug] player-resigned: ' + JSON.stringify(data));
    });

    chessHiveGameSocket.on('player-connected', function (data) {
      console.log('[debug] player-connected: ' + JSON.stringify(data));
    });
    chessHiveGameSocket.on('player-disconnected', function (data) {
      console.log('[debug] player-disconnected: ' + JSON.stringify(data));
    });
    chessHiveGameSocket.on('joined-room', function (data) {
      console.log('[debug] joined-room: ' + JSON.stringify(data));
    });
    chessHiveGameSocket.on('left-room', function (data) {
      console.log('[debug] left-room: ' + JSON.stringify(data));
    });

    /*
     * Notify that the game is full => impossible to join the game
     */
    chessHiveGameSocket.on('room-max-capacity-reached', function () {
      //alert("This game has been already joined by too many people.");
    });


    chessHiveGameSocket.forward('self-joined-room', $scope);
    $scope.$on('socket:self-joined-room', function (event, data) {
      console.log('[debug] socket:self-joined-room: ' + JSON.stringify(data));
      chessHiveGameSocket.emit('player-connect', {
        token: token
      });

      $scope.$on('$destroy', function () {
        console.log('[debug] emit player-disconnect');
        chessHiveGameSocket.emit('player-disconnect', {
          token: token
        });
      });
    });

    console.log('[debug] emit join-room');
    chessHiveGameSocket.emit('join-room', {
      token: token
    });

    $scope.$on('$destroy', function () {
      console.log('[debug] emit leave-room');
      chessHiveGameSocket.emit('leave-room', {
        token: token
      });
    });

    $scope.$on('chesshive:vote-for-suggested-move', function (event, data) {
      suggestMove(data.color, data.san, data.source, data.target);
    });
  });
