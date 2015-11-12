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

  .factory('chessHiveGameSocket', function (socketFactory) {
    var username = 'Anonymous';

    //var socket = io('http://localhost:3000', {query: 'user=' + username});
    var socket = io('http://chess.openmrc.com', {query: 'user=' + username});

    var chessHiveGameSocket = socketFactory({
      ioSocket: socket
    });

    return chessHiveGameSocket;
  })

  .directive('chessHivePlayerStats', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<ul class="list-unstyled">' +
      '<li><i class="fa fa-circle-o"></i> White {{ playerStats.white | number:0 }}</li>' +
      '<li><i class="fa fa-circle"></i> Black: {{ playerStats.black | number:0 }}</li>' +
      '</ul>',
      controller: function ($scope) {
        $scope.playerStats = {};
        /*
         * A new move has been suggested by a player => update the UI with information
         */
        chessHiveGameSocket.forward('player-stats', $scope);
        $scope.$on('socket:player-stats', function (event, data) {
          $scope.playerStats = data;
        });
      }
    };
  })

  .directive('chessHiveSuggestedMoves', function ($timeout, chessHiveGameSocket) {
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

        chessHiveGameSocket.forward('new-move', $scope);
        $scope.$on('socket:new-move', function (event, data) {
          var latestMove = data;
          console.log('a user suggested a move for ' + latestMove.color + ':' + JSON.stringify(latestMove));
        });

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

  .directive('chessHiveTimeToNextDigest', function ($timeout, chessHiveGameSocket) {
    return {
      scope: {},
      template: '<div>' +
      '{{timeToNextDigest / 1000 | number:precision}}s' +
      '<div class="progress" style="height: 5px;">' +
      '<div class="progress-bar progress-bar-striped active" ' +
      ' role="progressbar" aria-valuenow="{{timeToNextDigest}}" aria-valuemin="0" aria-valuemax="{{digestTimeout}}" ' +
      ' style="width: {{ percentage | number:0 }}%">' +
      '<span class="sr-only">{{ percentage | number:0 }}% Complete</span>' +
      '</div>' +
      '</div>' +
      '</div>',
      controller: function ($scope) {
        $scope.fullSecond = 0;
        $scope.timeToNextDigest = 0;
        $scope.precision = 0;
        $scope.percentage = 0;
        $scope.digestTimeout = 0;

        var countDownTimerTimeout = null;
        chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
        $scope.$on('socket:new-top-rated-game-move', function (event, data) {
          $scope.digestTimeout = data.digestTimeout;
          var timeToNextDigestInMs = data.nextDigestTime - Date.now();

          $timeout.cancel(countDownTimerTimeout);
          var updateCountDownTimer = function () {
            if (timeToNextDigestInMs <= 0) {
              $scope.timeToNextDigest = 0;
              return -1;
            }

            var nextTimerUpdate = 1000;
            $scope.precision = 0;

            $scope.timeToNextDigest = timeToNextDigestInMs;

            $scope.fullSecond = Math.floor($scope.timeToNextDigest / 1000);
            $scope.percentage = $scope.timeToNextDigest / $scope.digestTimeout * 100;

            if ($scope.timeToNextDigest <= 11000) {
              nextTimerUpdate = 100;
            }
            if ($scope.timeToNextDigest < 10000) {
              $scope.precision = 1;
            }

            var offset = ($scope.timeToNextDigestInMs - ($scope.fullSecond * 1000));
            nextTimerUpdate = nextTimerUpdate - offset;

            countDownTimerTimeout = $timeout(updateCountDownTimer, nextTimerUpdate);
            timeToNextDigestInMs = data.nextDigestTime - Date.now();
            return countDownTimerTimeout;
          };
          countDownTimerTimeout = updateCountDownTimer();
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
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
      });

      // illegal move
      if (move === null) {
        console.log('[debug] onDrop - illegal move');
        return 'snapback';
      }

      var vote = {
        token: token,
        san: move.san,
        source: source,
        target: target,
        piece: piece,
        turn: color,
        newPosition: ChessBoard.objToFen(newPos),
        oldPosition: ChessBoard.objToFen(oldPos)
      };
      chessHiveGameSocket.emit('new-move', vote);

      $scope.model.vote = vote;
      $scope.model.voted = true;

      $scope.model.vote = {
        token: token,
        source: source,
        target: target,
        piece: piece,
        turn: color,
        newPosition: ChessBoard.objToFen(newPos),
        oldPosition: ChessBoard.objToFen(oldPos)
      };

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
      $scope.model.pieceImageSrc = '/images/chesspieces/wikipedia/' + color.charAt(0) + 'K.png';

      $scope.model.isInTurn = isInTurn();

      $scope.board.orientation(color);
    });

    var isInTurn = function () {
      return $scope.model.joined && game.turn() === $scope.model.color.charAt(0);
    };
    /*
     * A new move has been chosen by the server => update the UI with the move
     */
    chessHiveGameSocket.forward('new-top-rated-game-move', $scope);
    $scope.$on('socket:new-top-rated-game-move', function (event, data) {
      console.log('[debug] socket:new-top-rated-move: ' + JSON.stringify(data));

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
      if ($scope.model.joined === true) {
        chessHiveGameSocket.emit('new-vote-resign', {
          token: token
        });
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
