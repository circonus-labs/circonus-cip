var makeTrap = require('./httptrap');

module.exports = function(uuid, secret, options) {
  options = options || {};
  var trap = makeTrap(uuid, secret, options);
  if(options.onError) trap.on('error', options.onError);
  else trap.on('error', function() {});
  trap.publish();

  return function(req, res, next) {
    if(req && req.route) {
      if(req.timers && req.timers) {
        try {
          var times = req.timers.map(function(a) { return a.time[0] + a.time[1] * 1e-9; });
          times.sort();
          var s = times.pop();
          var metric_name = 'restify`' + req.route.method + '`' + req.route.path;
          if(req.route.version) metric_name = metric_name + '`' + req.route.version;
          trap.record(metric_name + '`latency', s);
        } catch(e) { /* never screw up the server */ }
      }
    }
    if(next) next();
  }
}
