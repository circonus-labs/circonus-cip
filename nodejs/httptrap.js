'use strict';
const https = require('https');
const EventEmitter = require('events');
const traps = {};
const defaultBroker = 'trap.noit.circonus.net';
let defaultCa;


class Trap extends EventEmitter {
  constructor(uuid, secret, options) {
    super();

    if (!options) {
      options = {};
    }

    this.uuid = uuid;
    this.secret = secret;
    this.broker = options.broker || defaultBroker;
    this.throwErrors = options.throwErrors;
    this.data = {}
    this._pubint = undefined;
  }

  record(endpoint, value) {
    const data = this.data;

    if (!data.hasOwnProperty(endpoint)) {
      data[endpoint] = { '_type': 'n', '_value': {} };
    }

    const vString = normalize(value);

    if (!data[endpoint]._value.hasOwnProperty(vString)) {
      data[endpoint]._value[vString] = 1;
    } else {
      data[endpoint]._value[vString] = data[endpoint]._value[vString] + 1;
    }
  }

  publish(interval) {
    if (interval !== 0 && !interval) {
      interval = 500;
    }

    if (this._pubint !== undefined) {
      clearInterval(this._pubint);
    }

    if (interval != 0) {
      this._pubint = setInterval(() => {
        this.push();
      }, interval);
    }
  }

  push() {
    let b = this.data;
    const keys = Object.keys(b);

    // Only work with own properties.
    if (Object.keys(b).length === 0) {
      return;
    }

    this.data = {};
    b = collapse(b);
  
    const options = {
      hostname: this.broker,
      port: 443,
      path: '/module/httptrap/' + this.uuid + '/' + this.secret,
      method: 'PUT',
    };
  
    // If using default host, include the self-signed certificate
    if (options.hostname === defaultBroker) {
      options.ca = getDefaultCa();
    }
  
    const req = https.request(options, (res) => {
      let backside = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        backside += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          let sError;

          try {
            const obj = JSON.parse(backside);
            sError = obj.error;
          } catch (err) { }

          if (!sError) {
            sError = 'status ' + res.statusCode;
          }

          this.emit('error', new Error(sError));
        }
      });
    });

    req.on('error', (err) => {
      if (this.throwErrors) {
        throw err;
      }
    });

    const payload = JSON.stringify(b);
    // Set Content-Length to avoid using chunked encoding
    req.setHeader('Content-Length', Buffer.byteLength(payload));
    req.write(payload);
    req.end();
  }
}


function collapse(obj) {
  const newobj = {};
  const keys = Object.keys(obj);  // Loop over own properties.

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = obj[k];

    if (typeof v === 'object') {
      if (k === '_value') {
        newobj[k] = Object.keys(v).map((hkey) => {
          return hkey + '=' + v[hkey];
        });
      } else {
        newobj[k] = collapse(v);
      }
    } else {
      newobj[k] = v;
    }
  }

  return newobj;
}


function normalize(vOrig) {
  let v = vOrig;
  let vString = '';
  let exp = 0;

  if (v === 0) {
    return 'H[0]';
  }

  if (v < 0) {
    vString = '-';
    v = -v;
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
  vString = 'H[' + vString + v + 'e' + exp + ']';
  return vString;
}


function getDefaultCa() {
  if (defaultCa === undefined) {
    defaultCa = "-----BEGIN CERTIFICATE-----\n" +
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
  }

  return defaultCa;
}


function target(uuid, secret, options) {
  let key = uuid + '/' + secret;

  if (options && options.broker) {
    key = key + '/' + options.broker;
  }

  if (traps.hasOwnProperty(key)) {
    return traps[key];
  }

  traps[key] = new Trap(uuid, secret, options);
  return traps[key];
}


module.exports = target;
