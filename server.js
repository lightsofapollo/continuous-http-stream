var fs = require('fs');
var temporary = require('temporary');
var debug = require('debug')('continuous-http');
var rangeParser = require('http-range-parse');

var Promise = require('promise');
var EventEmitter = require('events').EventEmitter;
var WritableStream = require('stream').Writable;

var stat = Promise.denodeify(fs.stat);

function decorateWrite(stream) {
  var write = stream.write;
  stream.write = function(data, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = null;
    }

    return write.call(stream, data, encoding, function() {
      stream.emit('write', stream);
      callback && callback.apply(stream, arguments);
    })
  };
  return stream;
}

/**
Write the contents of a given file to the target stream staring at
the given offset until the end of the file... Return the ending offset + 1.

It is safe to call this method with a startOffset > then current size of the
file.

@param {String} file to read.
@param {Number} startOffset where to start reading from.
@param {null|Number} maxOffset to read to when null read until end.
@param {WritableStream} target stream to write to.

@return {Number} Current ending offset + 1.
*/
function readOffsetInto(file, startOffset, maxOffset, target) {
  // Current position in the overall stream/file...
  return new Promise(function(accept) {
    var options = { autoClose: true, start: startOffset };
    // Intentional use of != for null/undefined.
    if (maxOffset != undefined) {
      options.end = maxOffset;
    }

    var reader = fs.createReadStream(file, options);
    // This must not actually end the stream...
    reader.pipe(target, { end: false });
    var bytesRead = 0;
    function countBytes(buffer) {
      bytesRead += buffer.length;
    }

    reader.on('data', countBytes);
    reader.once('end', function() {
      var read = startOffset + bytesRead;
      reader.removeListener('data', countBytes);
      accept(read);
    });
  });
}

function Server() {
  this.paths = {};
  EventEmitter.call(this);
}

Server.prototype = {
  __proto__: EventEmitter.prototype,

  /**
  Return the handler for public operations (getting streams).
  */
  callback: function() {
    return function(req, res) {
      var path = req.url;
      if (!this.paths[path]) {
        res.writeHead(404);
        res.end();
        return;
      }

      this.serve(req, res);
    }.bind(this);
  },

  register: function(path, headers, stream) {
    var cachePath = (new temporary.File()).path;
    var cacheStream = fs.createWriteStream(cachePath);

    var detail = this.paths[path] = {
      path: path, // Public path.
      headers: headers || {}, // Header data.
      stream: stream, // Incoming data.
      streamOffset: 0, // Current number of bytes read of data.
      cachePath: cachePath, // Location of the file system cache.
      cacheStream: cacheStream // Writable cache stream for tracking.
    };
    stream.pipe(decorateWrite(cacheStream));
  },

  /**
  Resolve the byte ranges from the headers.

  @param {Object} headers from request.
  @return {Object|Null} object with .startOffset/.endOffset values.
  */
  resolveOffsets: function(headers) {
    if (!headers.range) {
      // Start at the first byte continue until the last byte.
      return { start: 0, end: null }
    }

    var parsedRange = rangeParser(headers.range);
    if (parsedRange.unit !== 'bytes' || parsedRange.ranges) {
      return null;
    }

    return {
      start: parsedRange.first || 0,
      end: parsedRange.suffix || parsedRange.last || null
    };
  },

  /**
  Server the contents for a given path... Note that this is a long lived http
  GET request.
  */
  serve: function(req, res) {
    var detail = this.paths[req.url];
    var offsets = this.resolveOffsets(req.headers);

    // If we cannot resolve offsets reply with a format error.
    if (!offsets) {
      debug('serve error');
      res.writeHeader(400);
      return res.end('Invalid range headers.');
    }

    // The request should be successful at this point so write headers.
    for (var header in detail.headers) {
      console.log(header, detail.headers[header]);
      res.setHeader(header, detail.headers[header]);
    }
    res.writeHeader(200);

    var queue = {
      start: offsets.start,
      end: offsets.end,
      reading: false,

      _read: function() {
        return readOffsetInto(detail.cachePath, this.start, this.end, res);
      },

      read: function() {
        // At the end of each read call we verify that we really cannot read any
        // more bytes before marking this false again.
        if (this.reading) return Promise.resolve();

        this.reading = true;
        return this._read().then(function(newOffset) {
          // Done reading...
          this.reading = false;

          // Ensure we don't queue extra reads if byte range fetching...
          if (this.end !== null && newOffset >= this.end) {
            return;
          }

          // Mark our progress...
          this.start = newOffset;
          // If we can actually read more continue...
          setTimeout(function() {
            console.log('read', this.start, this.end, detail.cacheStream.bytesWritten);
          }.bind(this), 750);
          if (this.start < detail.cacheStream.bytesWritten) {
            // Begin reading again...
            return this.read();
          }
        }.bind(this));
      }
    };

    var read = queue.read.bind(queue);
    read();
    detail.cacheStream.on('write', function() {
      read();
    });

    // The stream will eventually trigger the cache stream to be completely
    // written which triggers the finalization of this request.
    detail.cacheStream.on('finish', function() {
      debug('got finish issue final reads...', req.url);
      // Ensure we no longer watch for events...
      detail.stream.removeListener('data', read);
      // Ensure we read any final data that we where waiting on...
      queue.read().then(function() {
        debug('completed request for %s', req.url);
        res.end();
      });
    });
  }
};

module.exports = Server;
