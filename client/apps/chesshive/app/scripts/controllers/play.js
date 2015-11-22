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

  .directive('chesshiveGameOverMessage', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<div class="panel panel-default" data-ng-if="showGameOverMessage">' +
      ' <div class="panel-heading">' +
      '  <h4>Game over</h4>' +
      ' </div>' +
      ' <div class="panel-body">' +
      '  <div class="alert alert-info">' +
      '   {{ gameOverData | json }}' +
      '  </div>' +
      '  <div data-ng-if="gameOverData.restarts" ' +
      '    data-chesshive-countdown ' +
      '    data-time="model.countdown"' +
      '    data-show-progress-bar="true"' +
      '   ></div>' +
      ' </div>' +
      ' <div class="panel-footer">' +
      ' </div>' +
      '</div>',
      controller: function ($scope, $timeout) {
        $scope.showGameOverMessage = false;
        $scope.model = {};

        chessHiveGameSocket.forward('game-over', $scope);
        $scope.$on('socket:game-over', function (event, data) {
          $scope.gameOverData = data;
          $scope.showGameOverMessage = true;

          if ($scope.gameOverData.restarts) {
            $scope.model.countdown = $scope.gameOverData.restartTimeout;
            $timeout(function () {
              $scope.showGameOverMessage = false;
            }, $scope.model.countdown);
          }
        });
      }
    };
  })
  .directive('chesshivePlayerStats', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<ul class="list-unstyled">' +
      '<li><i class="fa fa-circle-o"></i> White {{ playerStats.white | number:0 }}</li>' +
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

  .directive('chesshiveSuggestedMoves', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {
        isInTurn: '='
      },
      template: '<div>' +
      '<h4>Suggestions</h4>' +
      '<div data-ng-hide="movesHaveBeenSuggested">' +
      ' <p>No move suggestions yet.</p>' +
      ' <div class="alert bg-primary" data-ng-if="isInTurn">' +
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
      '<span data-ng-show="movesHaveBeenSuggested">{{suggestedMoves | json}}</span>' +
      '</div>',
      controller: function ($scope) {
        $scope.movesHaveBeenSuggested = false;
        $scope.suggestedMoves = null;

        chessHiveGameSocket.forward('suggested-moves', $scope);
        $scope.$on('socket:suggested-moves', function (event, data) {
          if (data.team) {
            $scope.movesHaveBeenSuggested = _.keys(data.team).length > 0;
            $scope.suggestedMoves = data.team;
          }
        });

        chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
        $scope.$on('socket:new-top-rated-game-move', function () {
          $scope.suggestedMoves = null;
          $scope.movesHaveBeenSuggested = false;
        });
      }
    };
  })
  .directive('chesshiveCountdown', function ($timeout) {
    return {
      scope: {
        time: '=',
        max: '=',
        showProgressBar: '@'
      },
      template: '<div data-ng-show="countdown >= 0">' +
      ' {{countdown / 1000 | number:precision}}s' +
      ' <div class="progress" data-ng-show="showProgressBar" style="height: 5px;">' +
      '  <div class="progress-bar progress-bar-striped active" ' +
      '    role="progressbar" aria-valuenow="{{countdown}}" aria-valuemin="0" aria-valuemax="{{timeLengthInMs}}" ' +
      '    style="width: {{ percentage | number:0 }}%">' +
      '   <span class="sr-only">{{ percentage | number:0 }}% Complete</span>' +
      '  </div>' +
      ' </div>' +
      '</div>',
      controller: function ($scope) {
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
      }
    };
  })
  .directive('chesshiveTimeToNextDigest', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<div>' +
      ' <div data-ng-show="!gameOver">' +
      ' <div data-chesshive-countdown ' +
      '  data-time="model.countdown"' +
      '  data-show-progress-bar="true"' +
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

/**
 * @ngdoc function
 * @name chesshiveApp.controller:HiveGameCtrl
 * @description
 * # HiveGameCtrl
 * Controller of the chesshiveApp
 */
  .controller('HiveChessGameCtrl', function ($scope, $timeout, chessHiveGameSocket) {
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
    $scope.onDrop = function (source, target, piece, newPos, oldPos/*, orientation*/) {
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

      var vote = {
        token: token,
        turn: color,
        resign: false,
        move: {
          san: move.san,
          source: source,
          target: target,
          piece: piece,
          newPosition: ChessBoard.objToFen(newPos),
          oldPosition: ChessBoard.objToFen(oldPos)
        }
      };
      chessHiveGameSocket.emit('new-move', vote);

      $scope.model.voted = true;
      $scope.model.vote = vote.move;

      Messenger().post({
        message: 'Your move has been suggested: ' + source + ' -> ' + target,
        type: 'success',
        showCloseButton: true,
        hideAfter: 3
      });
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
      $scope.model.pieceImageSrc = 'images/chesspieces/wikipedia/' + color.charAt(0) + 'K.png';

      $scope.model.isInTurn = isInTurn();

      $scope.board.orientation(color);
    });

    var isInTurn = function () {
      return !$scope.model.gameOver && $scope.model.joined && game.turn() === $scope.model.color.charAt(0);
    };
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
          type: 'success',
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

    /*
     * Notify that the game is full => impossible to join the game
     */
    chessHiveGameSocket.on('full', function () {
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
  });
