'use strict';

/* eslint-disable no-prototype-builtins */

const EventEmitter = require('events');
const http = require('http');
const url = require('url');

const agentTraps = {};

/**
 * collapse object for transmission
 * @arg {Object} obj original objet
 * @returns {Object} collapsed object
 */
function collapse(obj) {
    const newobj = {};

    for (const key of Object.keys(obj)) {
        const val = obj[key];

        if (typeof val === 'object') {
            if (key === '_value') {
                newobj[key] = Object.keys(val).map((hkey) => {
                    return `${hkey}=${val[hkey]}`;
                });
            } else {
                newobj[key] = collapse(val);
            }
        } else {
            newobj[key] = val;
        }
    }

    return newobj;
}

/**
 * normalizes a value
 * @arg {numeric} vOrig original value
 * @returns {String} normalized value
 */
function normalize(vOrig) {
    let val = vOrig;
    let vString = '';
    let exp = 0;

    if (val === 0) {
        return 'H[0]';
    }

    if (val < 0) {
        vString = '-';
        val = -val;
    }

    while (val < 10) {
        val *= 10;
        exp -= 1;
    }

    while (val >= 100) {
        val /= 10;
        exp += 1;
    }

    val = Math.floor(val);
    val /= 10;
    exp += 1;
    vString = `H[${vString}${val}e${exp}]`;

    return vString;
}

class Agent extends EventEmitter {


    /**
     * initialize new agent object
     * @arg {String} agentURL to submit metrics to
     */
    constructor(agentURL) {
        super();
        this.agentURL = url.parse(agentURL);
        this.data = {};
        this._publishInterval = null;
    }

    /**
     * records a value
     * @arg {String} endpoint name to record
     * @arg {Numeric} value to record
     * @returns {Undefined} nothing
     */
    record(endpoint, value) {
        const self = this;
        // const data = this.data;

        if (!Object.hasOwnProperty(self.data, endpoint)) {
            self.data[endpoint] = { _type: 'n', _value: {} };
        }

        const vString = normalize(value);

        if (Object.hasOwnProperty(self.data[endpoint]._value, vString)) {
            self.data[endpoint]._value[vString] += 1;
        } else {
            self.data[endpoint]._value[vString] = 1;
        }
    }

    /**
     * records a value
     * @arg {Numeric} interval to publish metrics on
     * @returns {Undefined} nothing
     */
    publish(interval) {
        let newInterval = interval;

        if (interval !== 0 && !interval) {
            newInterval = 10000;
        }

        if (this._publishInterval !== null) {
            clearInterval(this._publishInterval);
        }

        if (newInterval !== 0) {
            this._publishInterval = setInterval(() => {
                this.push();
            }, newInterval);
        }
    }

    /**
     * manually submit metrics to endpoint
     * @returns {Undefined} nothing
     */
    push() {
        const self = this;
        const keys = Object.keys(self.data);

        // Only work with own properties.
        if (keys.length === 0) {
            return;
        }

        let data = self.data;

        this.data = {}; // reset
        data = collapse(data);

        const options = self.agentURL;

        options.method = 'PUT';

        const req = http.request(options, (res) => {
            let backside = '';

            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                backside += chunk;
            });

            res.on('end', () => {
                if (res.statusCode !== 204) { // agent returns no-content when it accepts the data
                    let sError = null;

                    try {
                        const obj = JSON.parse(backside);

                        sError = obj.error;
                    } catch (ignoreErr) {
                    // ignore
                    }

                    if (sError === null) {
                        sError = `status ${res.statusCode}`;
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

        const payload = JSON.stringify(data);
        // Set Content-Length to avoid using chunked encoding

        req.setHeader('Content-Length', Buffer.byteLength(payload));
        req.write(payload);
        req.end();
    }

}

/**
 * initialize new agent instance or return existing instance
 * @arg {String} agentURL to submit metrics to
 * @returns {Object} agent instance
 */
function target(agentURL) {
    if (agentURL === null || agentURL === '') {
        throw new Error('invalid submission url');
    }

    const key = agentURL;

    if ({}.hasOwnProperty(agentTraps, key)) {
        return agentTraps[key];
    }

    agentTraps[key] = new Agent(agentURL);

    return agentTraps[key];
}


module.exports = target;
