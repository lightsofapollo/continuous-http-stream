## Features

### Long lived http streams:

The intention is that clients can connect to the server via http get and
continuously stream data via a "content-length-less" response. The request
is safe to retry with byte range fetching.

### Byte range fetching:

Note that per [rfc7233](http://tools.ietf.org/html/rfc7233#section-2.1)
byte range fetching is inclusive meaning range 0-0 will give you the
first byte and is a valid range.

# Random Notes

There is something going on with memory allocation (rss not js heap) on
OSX under high load with streams... From my observations this does not
occur on Linux but if we are seeing terrible random high spikes.

