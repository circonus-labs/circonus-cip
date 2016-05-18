var util=require("util"),
    os=require("os"),
    https=require("https"),
    events = require("events"),
    hostname = os.hostname(),
    trap, traps = {};

trap = function(uuid, secret, options) {
  if(!options) options = {};
  this.uuid = uuid;
  this.secret = secret;
  this.broker = options.broker || 'trap.noit.circonus.net';
  this.throwErrors = options.throwErrors;
  this.data = {}
}
util.inherits(trap, events.EventEmitter);

function target(uuid, secret, options) {
  var key = uuid + '/' + secret;
  if(options && options.broker) {
    key = key + '/' + options.broker;
  }
  if(traps.hasOwnProperty(key)) return traps[key];
  traps[key] = new trap(uuid, secret, options);
  return traps[key];
}

function collapse(obj) {
  var newobj = {};
  for(var k in obj) {
    if(obj.hasOwnProperty(k)) {
      var v = obj[k];
      if(k === '_value' && typeof(v) === 'object') {
        var arr_replace = [];
        for(var hkey in v) {
          if(v.hasOwnProperty(hkey)) arr_replace.push('' + hkey + '=' + v[hkey]);
        }
        newobj[k] = arr_replace;
      }
      else if(typeof(v) === 'object') {
        newobj[k] = collapse(v);
      }
      else
        newobj[k] = v;
    }
  }
  return newobj;
}
function normalize(vOrig) {
  var v = vOrig, vString = '', exp = 0;
  if (v == 0) return 'H[0]';
  if (v < 0) {
    vString = '-';
    v = v * -1;
  }
  while (v < 10) {
    v = v * 10;
    exp = exp - 1;
  }
  while (v >= 100) {
    v = v / 10;
    exp = exp + 1;
  }
  v = Math.floor(v);
  v = v / 10;
  exp = exp + 1;
  vString = 'H[' + vString + v.toString() + 'e' + exp.toString() + ']';
  return vString;
}
trap.prototype.record = function(endpoint, value) {
  if(!this.data.hasOwnProperty(endpoint)) this.data[endpoint] = { '_type': 'n', '_value': { } };
  var vString = normalize(value);
  if(!this.data[endpoint]._value.hasOwnProperty(vString))
    this.data[endpoint]._value[vString] = 1;
  else
    this.data[endpoint]._value[vString] = this.data[endpoint]._value[vString] + 1;
}

trap.prototype.push = function() {
  var lThis = this,
      b = this.data,
      doit = false;
  this.data = {};
  for (var k in b) {
    if(b.hasOwnProperty(k)) {
      doit = true;
      break;
    }
  }
  if(!doit) return;
  b = collapse(b);

  var options = {
    hostname: 'trap.noit.circonus.net',
    port: 443,
    path: '/module/httptrap/' + this.uuid + '/' + this.secret,
    method: 'PUT',
    ca:
"-----BEGIN CERTIFICATE-----\n" +
"MIID4zCCA0ygAwIBAgIJAMelf8skwVWPMA0GCSqGSIb3DQEBBQUAMIGoMQswCQYD\n" +
"VQQGEwJVUzERMA8GA1UECBMITWFyeWxhbmQxETAPBgNVBAcTCENvbHVtYmlhMRcw\n" +
"FQYDVQQKEw5DaXJjb251cywgSW5jLjERMA8GA1UECxMIQ2lyY29udXMxJzAlBgNV\n" +
"BAMTHkNpcmNvbnVzIENlcnRpZmljYXRlIEF1dGhvcml0eTEeMBwGCSqGSIb3DQEJ\n" +
"ARYPY2FAY2lyY29udXMubmV0MB4XDTA5MTIyMzE5MTcwNloXDTE5MTIyMTE5MTcw\n" +
"NlowgagxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMI\n" +
"Q29sdW1iaWExFzAVBgNVBAoTDkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJj\n" +
"b251czEnMCUGA1UEAxMeQ2lyY29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4w\n" +
"HAYJKoZIhvcNAQkBFg9jYUBjaXJjb251cy5uZXQwgZ8wDQYJKoZIhvcNAQEBBQAD\n" +
"gY0AMIGJAoGBAKz2X0/0vJJ4ad1roehFyxUXHdkjJA9msEKwT2ojummdUB3kK5z6\n" +
"PDzDL9/c65eFYWqrQWVWZSLQK1D+v9xJThCe93v6QkSJa7GZkCq9dxClXVtBmZH3\n" +
"hNIZZKVC6JMA9dpRjBmlFgNuIdN7q5aJsv8VZHH+QrAyr9aQmhDJAmk1AgMBAAGj\n" +
"ggERMIIBDTAdBgNVHQ4EFgQUyNTsgZHSkhhDJ5i+6IFlPzKYxsUwgd0GA1UdIwSB\n" +
"1TCB0oAUyNTsgZHSkhhDJ5i+6IFlPzKYxsWhga6kgaswgagxCzAJBgNVBAYTAlVT\n" +
"MREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMIQ29sdW1iaWExFzAVBgNVBAoT\n" +
"DkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJjb251czEnMCUGA1UEAxMeQ2ly\n" +
"Y29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4wHAYJKoZIhvcNAQkBFg9jYUBj\n" +
"aXJjb251cy5uZXSCCQDHpX/LJMFVjzAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEB\n" +
"BQUAA4GBAAHBtl15BwbSyq0dMEBpEdQYhHianU/rvOMe57digBmox7ZkPEbB/baE\n" +
"sYJysziA2raOtRxVRtcxuZSMij2RiJDsLxzIp1H60Xhr8lmf7qF6Y+sZl7V36KZb\n" +
"n2ezaOoRtsQl9dhqEMe8zgL76p9YZ5E69Al0mgiifTteyNjjMuIW\n" +
"-----END CERTIFICATE-----\n"
  };
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    var backside = '';
    res.on('data', function (chunk) {
      backside = backside + chunk;
    });
    res.on('end', function() {
      if(res.statusCode != 200) {
        var sError;
        try {
          var obj = JSON.parse(backside);
          sError = obj.error;
        } catch(e) { }
        if(!sError) sError = "status " + res.statusCode;
        lThis.emit('error', sError);
      }
    });
  });
  var throwErrors = this.throwErrors;
  req.on('error', function(e) {
    if(throwErrors) throw(e);
  });
  var payload = JSON.stringify(b);
  req.write(payload);
  req.end();
}

trap.prototype.publish = function(interval) {
  if(interval !== 0 && !interval) interval = 500;
  if(this._pubint) clearInterval(this._pubint);
  if(interval != 0) {
    this._pubint = (function(lThis) { setInterval(function() { lThis.push() }, 500); })(this);
  }
}

module.exports = target;
