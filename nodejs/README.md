# Circonus Instrumentation Pack for NodeJS

This intrumentation pack is design to allow nodejs applications to easily report telemetry data to Circonus. It has special support for providing sample-free (100% sampling) collection of service latencies for submission, visualization and alerting to Circonus.

Each example has a "uuid" and "secret".  These are attached to an HTTPTrap check that you've already configured within Circonus.  Simply create a new JSON push (HTTPTrap) check in circonus using the HTTPTRAP broker and on the check details page the uuid and secret will be available.  This can be done via [the user interface](https://login.circonus.com/user/docs/Data/CheckTypes#HTTPTrap) or via [the API](https://login.circonus.com/resources/api/calls/check_bundle).  The "target" for the check does not need to be an actual hostname or IP address; the name of your service might be a good substitute.

It is suggested that you use a different trap for different nodejs apps as well as for production, staging and testing.

## Restify Integration

    var circonus_uuid = '<uuid>',
        circonus_secret = '<secret>',
        circonus_cip = require('circonus-cip');

    server.on('after', circonus_cip.restify(circonus_uuid, circonus_secret))

The restify integration tries to simplify metric names so if no versioning of the restify routes exists versioning is left out of the metric name.  Routes without versions will report latencies using metrics names like ``restify`<method>`<routepath>`latency`` and those with versioning will look like ``restify`<method>`<routepath>`<version>`latency``.

## Hapi Integration

    var circonus_conf = { uuid: '<uuid>', secret: 'secret' };
    server.register({ register: require('circonus-cip').hapi,
                      options: circonus_conf,
                      function(err) {
                        if(err)
                          console.log('error', 'Failed loading  circonus-cip')
                      });

The Hapi integration models the hapi-statsd plugin in naming convention with
some token inversion to keep overall consistency with circonus-cip plugins.
The metrics will appear as ``hapi`<method>`<routepath>`latency``.  If the
API is serving a CORS request, the `<routepath>` will be `{cors*}`. If the
API encounters a request with no matching route, `<routepath>` will be
`{notFound*}`.

## Express Integration

    var circonus_uuid = '<uuid>',
        circonus_secret = '<secret>',
        circonus_cip = require('circonus-cip');
        
    var app = express();
    app.use(circonus_cip.express(circonus_uuid, circonus_secret));

The Express integration attaches to each routing pattern and logs latencies per route. Metric look like ``express`<method>`<routepath>`latency``.

## HTTPTrap

All of the aforementioned integrations sit atop the HTTPTrap metric submission tooling that can be used directly if desired.

This is a generalized HTTPTrap framework for submitting high-frequency
data to Circonus.  It can be used directly by or via ready-to-use
framework-aware helpers.

    var circonus_uuid = '<uuid>',
        circonus_secret = '<secret>',
        circonus_cip = require('circonus-cip'),
        trap = circonus_cip.makeTrap(circonus_uuid, circonus_secret)
    
    trap.publish()
    
    ...
    trap.record('metric_name', value)
    trap.record('other_metric', other_value)
    ...
    
    trap.publish(0)

For daemonized/long-running processes there is no need to `trap.publish(0)` to disable publication, instead just end the process via normal service control means.

It is highly recommended that values be in the most simple of units.  For example, if you are recording service latencies, use seconds.  The platform supports arbitrarily small numbers so representing microseconds or nanoseconds as "small" floating point values is both acceptable and desired.

By default, publish will run at cadence of 2Hz (a submission every 500ms).  The publish method takes an optional argument specifying the number of milliseconds between trap events; 0 disables publication.

Disabling publication will cause metrics recorded to queue and could pose memory consumption consequences.  While the data structures used are terse and memory bound per-metric, it is possible to exhaust memory this way by recording a an ever-increasing unique set of metric names. Again, this is only a risk if publication is disabled.
