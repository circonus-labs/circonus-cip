'use strict';
const makeTrap = require('../httptrap');
const pkg = require('../package.json');
const startSymbol = Symbol('circonusStartTime');
function noop() {}


function register(server, options) {
  const trap = makeTrap(options.uuid, options.secret, options);

  if (options.onError) {
    trap.on('error', options.onError);
  } else {
    trap.on('error', noop);
  }

  trap.publish();

  server.decorate('server', 'httptrap', trap);
  server.decorate('request', startSymbol, null);

  server.ext('onRequest', (request, h) => {
    request[startSymbol] = process.hrtime();
    return h.continue;
  });

  server.ext('onPreResponse', (request, h) => {
    if (request[startSymbol]) {
      const specials = request._core.router.specials;
      const route = request._route;
      let path;

      if (route === specials.notFound.route) {
        path = '{notFound*}';
      } else if (specials.options && route === specials.options.route) {
        path = '{cors*}';
      } else if (route.path === '/' && route.method === 'options') {
        path = '{cors*}';
      } else {
        path = route.path;
      }

      const statName = 'hapi`' + request.method.toUpperCase() + '`' +
                       path + '`latency';
      const duration = process.hrtime(request[startSymbol]);
      trap.record(statName, duration[0] + duration[1] * 1e-9);
    }

    return h.continue;
  });
};


module.exports = { register, pkg };
