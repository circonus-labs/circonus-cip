/* Parts of this are borrowed from https://github.com/expressjs/morgan/blob/master/index.js
 *
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 *
 * Copyright(c) 2016 Circonus, Inc.
 * MIT Licensed
 */

var onHeaders = require('on-headers'),
    onFinished = require('on-finished'),
    makeTrap = require('./httptrap');

module.exports = function(uuid, secret, options) {
  options = options || {};
  var trap = makeTrap(uuid, secret, options);
  if(options.onError) trap.on('error', options.onError);
  else trap.on('error', function() {});
  trap.publish();

  return function(req, res, next) {
    function recordLatency() {
      if (!req._startAt || !res._startAt) return;
      if (!req.route || !req.route.path) return;
      var s = (res._startAt[0] - req._startAt[0])
            + (res._startAt[1] - req._startAt[1]) * 1e-9;
      trap.record('express`' + req.method + '`' + req.route.path + '`latency', s);
    }
    req._startAt = undefined
    req._startTime = undefined
    res._startAt = undefined
    res._startTime = undefined
    recordStartTime.call(req);
    onHeaders(res, recordStartTime)
    onFinished(res, recordLatency)
    next();
  }
}

function recordStartTime() {
  this._startAt = process.hrtime()
  this._startTime = new Date()
}
