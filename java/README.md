# Circonus Instrumentation Pack for Java

### Backgrounder

Java has a very popular instrumentation library called "metrics."  Originally
written by Coda Hale and later adopted by dropwizard.  Metrics has some
great ideas that we support whole-heartedly; in particular, the use of histograms for more insightful reporting.
Unfortunately, the way this measurements are captured and reported makes calculating service level agreements and
other such analytics impossible.  Furthermore, the implementations of the
underlying histograms (Reservoirs in metrics-terminology) are opaque to the
reporting tools.  The Circonus metrics support is designed to layer 
(non-disruptively) on top of the Dropwizard metrics packages.

## Jump in

More information is avialable on the [circonus-metrics project page](https://github.com/circonus-labs/metrics-circonus).
