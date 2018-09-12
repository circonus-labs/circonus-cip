'use strict';

/* eslint-disable global-require */

module.exports = {
    express   : require('./express'),
    hapi      : require('./hapi/legacy'),
    makeAgent : require('./agent'),
    makeTrap  : require('./httptrap'),
    restify   : require('./restify')
};
