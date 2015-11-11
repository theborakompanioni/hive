'use strict';

/**
 * @ngdoc overview
 * @name chesshiveApp
 * @description
 * # chesshiveApp
 *
 * Main module of the application.
 */
angular
  .module('chesshiveApp', [
    'ngAnimate',
    'ngAria',
    'ngCookies',
    'ngMessages',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch',
    'nywton.chessboard',
    'btford.socket-io'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        controllerAs: 'main'
      })
      .when('/play', {
        templateUrl: 'views/play.html',
        controller: 'PlayCtrl',
        controllerAs: 'play'
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl',
        controllerAs: 'about'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .config([function () {
    Messenger.options = {
      extraClasses: 'messenger-fixed messenger-on-right messenger-on-top',
      theme: 'air'
    };
  }])
  .config(['nywtonChessboardConfigProvider', function (chessboardProvider) {
    chessboardProvider
      .draggable(true)
      .snapbackSpeed(500)
      .snapSpeed(150)
      .moveSpeed('slow')
      .position('')
      .pieceTheme('images/chesspieces/wikipedia/{piece}.png');
  }]);
