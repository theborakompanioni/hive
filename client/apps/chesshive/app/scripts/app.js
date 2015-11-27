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
  .constant('applicationConfig', (function () {
    var isBuildProcessReplacingVars = function hackyWayToSeeVarReplacement() {
      return '@@<!--' + '%build:replace%'.toLowerCase() + '-->' !== (function () {
          return '@@<!--%build:replace%-->';
        })();
    };
    var defaultConfig = {
      name: 'unnamed-app',
      debugEnabled: true,
      io: {
        host: 'http://localhost:3000'
      }
    };

    var replacedConfig = '<!--%app%-->';

    return isBuildProcessReplacingVars() ? replacedConfig : defaultConfig;

  })())
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        redirectTo: '/play'
      })
      .when('/home', {
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
      .showNotation(true)
      .snapbackSpeed(500)
      .snapSpeed(150)
      .moveSpeed('slow')
      .position('')
      .pieceTheme('images/chesspieces/wikipedia/{piece}.png');
  }])
  .config(function(applicationConfig, $logProvider) {
    $logProvider.debugEnabled(applicationConfig.debugEnabled);
  })
  .factory('chessHiveGameSocket', function (socketFactory, applicationConfig) {
    var username = 'Anonymous';

    var socketHost = applicationConfig.io.host;
    var socket = io(socketHost, {query: 'user=' + username});
    //var socket = io('http://chess.openmrc.com', {query: 'user=' + username});

    var chessHiveGameSocket = socketFactory({
      ioSocket: socket
    });

    return chessHiveGameSocket;
  })
  .filter('firstCharUppercase', function () {
    return function (input) {
      if (!input || (typeof input !== 'string' && !(input instanceof String))) {
        return input;
      }
      return input.substring(0, 1).toUpperCase() + input.substring(1);
    };
  })
  .controller('HeadCtrl', function (applicationConfig) {
    this.appName = applicationConfig.name;
  })
  .controller('NavbarCtrl', function (applicationConfig) {
    this.appName = applicationConfig.name;
  });
