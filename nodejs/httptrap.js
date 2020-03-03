'use strict';
const https = require('https');
const EventEmitter = require('events');
const traps = {};
const defaultBroker = 'api.circonus.com';

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
