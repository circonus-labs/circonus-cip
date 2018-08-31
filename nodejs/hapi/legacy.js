// Copyright(c) 2013 Mac Angell
// Copyright(c) 2016 Circonus, Inc.
module.exports.register = function (server, options, next) {
  var makeTrap = require('../httptrap'),
    path = require('path'),
    trap = makeTrap(options.uuid, options.secret, options),
    normalizePath = function(path) { return path };
  if(options.onError) trap.on('error', options.onError);
  else trap.on('error', function() {});
  trap.publish();

  server.decorate('server', 'httptrap', trap);
  server.ext('onRequest', function (request, reply) {
    request._circonusStartTime = process.hrtime();
    return reply.continue();
  });

  server.ext('onPreResponse', function (request, reply) {
    if (request._circonusStartTime) {
      var statusCode = (request.response.isBoom) ? request.response.output.statusCode : request.response.statusCode;

      var path = request._route.path;
      var specials = request.connection._router.specials;

      if (request._route === specials.notFound.route) {
        path = '{notFound*}';
      }
      else if (specials.options && request._route === specials.options.route) {
        path = '{cors*}';
      }
      else if (request._route.path === '/' && request._route.method === 'options'){
        path = '{cors*}';
      }

      var statName = 'hapi`' + request.method.toUpperCase() + '`' +
              normalizePath(path) + '`latency';
      var duration = process.hrtime(request._circonusStartTime);
      trap.record(statName, duration[0] + duration[1] * 1e-9);
    }
    reply.continue();
  });

  next();
};

module.exports.register.attributes = {
  pkg: require('../package.json')
};
