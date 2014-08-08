var fs = require('fs');
var temporary = require('temporary');
var debug = require('debug')('continuous-http');

var Promise = require('promise');
var EventEmitter = require('events').EventEmitter;

var stat = Promise.denodeify(fs.stat);
var rangeParser = require('http-range-parse');

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
  return stat(file).then(function(stats) {
    return stats.size;
  }).then(function(endOffset) {
    // Current position in the overall stream/file...
    return new Promise(function(accept) {
      debug('Begin read', startOffset, endOffset);
      if (maxOffset !== null && maxOffset <= endOffset) {
        endOffset = maxOffset;
      }
      // Don't read bytes that obviously cannot exist.
      if (startOffset > endOffset) return accept(startOffset);
      debug('Issue read', startOffset, endOffset);
      var reader = fs.createReadStream(file, {
        autoClose: true,
        start: startOffset,
        end: endOffset
      });

      // This must not actually end the stream...
      reader.pipe(target, { end: false });
      reader.once('end', function() {
        debug('End');
        // Increment the endOffset so the next read will start at the next
        // offset.
        accept(endOffset + 1);
      });
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
  Handler callback for managing requests.
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

  /**
  Register a stream to serve over the server. A temporary file is used to store
  the progress of the stream so multiple clients can connect and read from the
  beginning.
  */
  add: function(servePath, fileName) {
    this.paths[servePath] = {
      path: servePath,
      source: fileName
    };
  },

  close: function(servePath) {
    this.emit('close ' + servePath);
  },

  /**
  Resolve the byte ranges from the headers.

  @param {Object} headers from request.
  @return {Object|Null} object with .startOffset/.endOffset values.
  */
  resolveOffsets: function(headers) {
    if (!headers.range) {
      // Start at the first byte continue until the last byte.
      return { startOffset: 0, endOffset: null }
    }

    var parsedRange = rangeParser(headers.range);
    if (parsedRange.unit !== 'bytes' || parsedRange.ranges) {
      return null;
    }

    return {
      startOffset: parsedRange.first || 0,
      endOffset: parsedRange.suffix || parsedRange.last || null
    };
  },

  /**
  Server the contents for a given path... Note that this is a long lived http
  GET request.
  */
  serve: function(req, res) {
    debug('serve', req.url);
    var detail = this.paths[req.url];
    var offsets = this.resolveOffsets(req.headers);

    // If we cannot resolve offsets reply with a format error.
    if (!offsets) {
      debug('serve error');
      res.writeHeader(400);
      return res.end('Invalid range headers.');
    }

    debug('reading %s %s-%s', req.url, offsets.startOffset, offsets.endOffset);
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    // At this point the request should resolve...
    res.writeHeader(200);

    // Request wide state.
    var startOffset = offsets.startOffset; // current starting offset.
    var maxOffset = offsets.endOffset;

    // At most we can have a single read queued.
    var currentRead =
      readOffsetInto(detail.source, startOffset, maxOffset, res);

    var readPending = false;

    function issueRead() {
      console.log('ISSUE READ', readPending, startOffset, maxOffset);
      // If we are waiting for a read anyway do not issue another one.
      if (readPending) return currentRead;

      // Mark the internal state as waiting for a read so we do not queue many
      // extra `readOffsetInto` requests.
      readPending = true;

      return currentRead = currentRead.then(function(offset) {
        // Update the internal state allowing another read to be queued with the
        // next offset.
        readPending = false;
        startOffset = offset;
        return readOffsetInto(detail.source, startOffset, maxOffset, res);
      });
    }

    // Initialize the file watcher...
    var watcher = fs.watchFile(detail.source, { persistent: false }, function(e) {
      debug('file change', e);
      issueRead();
    });

    // We rely on the sender of "close" to know when the file has finished
    // writing we issue one last read/write to ensure we don't miss anything.
    this.once('close ' + detail.path, function() {
      debug('close', detail.path);
      // Ensure we no longer watch for events...
      watcher.close();

      // Ensure we read any final data that we where waiting on...
      issueRead().then(function() {
        debug('res end', detail.path);
        res.end();
      });
    });
  }
};

module.exports = Server;
