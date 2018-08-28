'use strict';
const assert = require('assert');
const events = require('events');
const http = require('http');
const https = require('https');
const lab = exports.lab = require('lab').script();
const uuid = require('uuid');
const standin = require('stand-in');
const httptrap = require('../httptrap');
const { describe, it } = lab;

describe('httptrap', () => {
  it('trap inherits from EventEmitter', (done) => {
    const id = uuid();
    const secret = uuid();
    const broker = uuid();
    const trap = httptrap(id, secret, { broker, throwErrors: true });

    assert.strictEqual(trap instanceof events.EventEmitter, true);
    assert.strictEqual(trap.uuid, id);
    assert.strictEqual(trap.secret, secret);
    assert.strictEqual(trap.broker, broker);
    assert.strictEqual(trap.throwErrors, true);
    assert.deepStrictEqual(trap.data, {});
    done();
  });

  it('repeat keys return the same trap', (done) => {
    const id = uuid();
    const broker = uuid();
    const trap1 = httptrap(id, 'secret', { broker });
    const trap2 = httptrap(id, 'secret', { broker });

    assert.strictEqual(trap1, trap2);
    done();
  });

  it('differentiates between brokers', (done) => {
    const id = uuid();
    const broker = uuid();
    const trap1 = httptrap(id, 'secret'); // Uses the default broker.
    const trap2 = httptrap(id, 'secret', { broker });

    assert.notStrictEqual(trap1, trap2);
    done();
  });

  it('records data', (done) => {
    const id = uuid();
    const trap = httptrap(id, id, { broker: id });

    trap.record('foo', -5);
    trap.record('foo', 0);
    trap.record('foo', 0);
    trap.record('foo', 5);
    trap.record('foo', 150);
    trap.record('foo', 1250);
    assert.deepStrictEqual(trap.data, {
      foo: {
        _type: 'n',
        _value: {
          'H[-5e0]': 1,
          'H[0]': 2,
          'H[5e0]': 1,
          'H[1.5e2]': 1,
          'H[1.2e3]': 1
        }
      }
    });
    done();
  });

  it('pushing does nothing if there is no data to send', (done) => {
    const id = uuid();
    const trap = httptrap(id, id, { broker: id });
    const data = trap.data;

    assert.deepStrictEqual(data, {});
    trap.push();
    assert.strictEqual(trap.data, data);
    done();
  });

  it('pushes data to the default broker', (done) => {
    const { server, trap } = mockServer(null, (req, res) => {
      res.end();
      server.close();
      done();
    }, () => {
      trap.record('foo', -5);
      trap.push();
    });
  });

  it('pushes data to a custom broker', (done) => {
    const { server, trap } = mockServer({ broker: uuid() }, (req, res) => {
      res.end();
      server.close();
      done();
    }, () => {
      trap.record('foo', -5);
      trap.push();
    });
  });

  it('handles errors when pushing to the server', (done) => {
    const { server, trap } = mockServer(null, (req, res) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }, () => {
      trap.on('error', (err) => {
        server.close();
        assert.strictEqual(err.message, 'Internal Server Error');
        done();
      });

      trap.record('foo', -5);
      trap.push();
    });
  });

  it('reports HTTP status code if error is missing/invalid', (done) => {
    const { server, trap } = mockServer(null, (req, res) => {
      res.writeHead(501);
      res.end();
    }, () => {
      trap.on('error', (err) => {
        server.close();
        assert.strictEqual(err.message, 'status 501');
        done();
      });

      trap.record('foo', -5);
      trap.push();
    });
  });

  it('swallows request errors by default', (done) => {
    const { server, trap } = mockServer({
      broker: 'abcdefghi'
    }, (req, res) => {
      assert.fail('this should not be called');
    }, () => {
      server.close();
      trap.record('foo', -5);
      trap.push();
      setImmediate(done);
    });
  });

  it('throws asynchronous request errors when throwErrors is true', (done) => {
    const domain = require('domain');
    const d = domain.create();

    d.on('error', (err) => {
      done();
    });

    d.run(() => {
      try {
        const { server, trap } = mockServer({
          broker: 'abcdefghi',
          throwErrors: true
        }, (req, res) => {
          assert.fail('this should not be called');
        }, () => {
          server.close();
          trap.record('foo', -5);
          trap.push();
        });
      } catch (err) {
        assert.fail('should not be able to catch error');
      }
    });
  });

  it('publishing utilizes an interval', (done) => {
    const id = uuid();
    const trap = httptrap(id, id, { broker: id });

    standin.replaceOnce(trap, 'push', () => {
      clearInterval(trap._pubint);
      done();
    });

    assert.strictEqual(trap._pubint, undefined);
    trap.publish();
    const interval = trap._pubint;
    assert.notStrictEqual(interval, undefined);
    trap.publish(0);    // interval should not change if value is 0.
    assert.strictEqual(trap._pubint, interval);
    trap.publish(10);   // interval changes if value is different.
    assert.notStrictEqual(trap._pubint, interval);
  });
});


function mockServer(options, onRequest, onListen) {
  const id = uuid();
  const secret = uuid();
  const trap = httptrap(id, secret, options);
  const server = http.createServer(onRequest);

  standin.replaceOnce(https, 'request', (stand, options, callback) => {
    assert.strictEqual(options.hostname, trap.broker);
    assert.strictEqual(options.port, 443);
    assert.strictEqual(options.path, '/module/httptrap/' + id + '/' + secret);
    assert.strictEqual(options.method, 'PUT');

    if (trap.broker === 'trap.noit.circonus.net') {
      assert.strictEqual(typeof options.ca, 'string');
    } else {
      assert.strictEqual(typeof options.ca, 'undefined');
    }

    const address = server.address();

    if (address) {
      options.hostname = address.address;
      options.port = address.port;
    }

    return http.request(options, callback);
  });

  server.listen(0, onListen);
  return { server, trap };
}
