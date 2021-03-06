suite('server', function() {
  var Handler = require('./server');
  var PassThrough = require('stream').PassThrough;
  var URL = require('url');

  var fs = require('fs');
  var http = require('http');

  suite('bursts', function() {
    var handler, server, url;
    setup(function() {
      handler = new Handler();
      server = http.createServer(handler.callback());
      server.listen(0);
      url = 'http://localhost:' + server.address().port;
    });

    test('many', function(done) {
      // Create a stream endpoint...
      var stream = new PassThrough();
      var chunks = [
        'abc1✔ ',
        'abc2✔ ',
        'abc3✔ ',
        'abc4✔ ',
        'abc5✔ ',
        'abc6✔ ',
        'abc7✔ ',
        'abc8✔✔✔✔'
      ];

      var expected = chunks.join('');
      handler.register('/xfoo', {}, stream);

      function writeStream() {
        var chunk = chunks.shift();
        if (!chunk) return;
        var x = stream.write(chunk);
        process.nextTick(writeStream);
      }

      // Ensure it can be read out.
      http.get(url + '/xfoo', function(res) {
        var buffer = '';
        res.on('data', function gotData(data) {
          buffer += data;
          console.log(buffer);
          if (buffer === expected) {
            res.removeListener('data', gotData);
            stream.end();
            res.once('end', done);
          }
        });
      }).end();

      // Kick off the writes to the stream...
      writeStream();
    });

    test('single', function(done) {
      // Create a stream endpoint...
      var stream = new PassThrough();
      var expected = 'foobar\nbaz';
      handler.register('/xfoo', {}, stream);

      // Write some data to the stream...
      stream.write(expected);

      // Ensure it can be read out.
      http.get(url + '/xfoo', function(res) {
        var buffer = '';

        res.on('data', function gotData(data) {
          buffer += data;
          if (buffer === expected) {
            res.removeListener('data', gotData);
            stream.end();
            res.once('end', done);
          }
        });
      }).end();
    });

    test('range: between', function(done) {
      // Create a stream endpoint...
      var stream = new PassThrough();
      var chunks = [
        '1 ',
        '2 ',
        '3 ',
        '4 ',
        '5 ',
        '6 ',
        '7 ',
        '8 ',
        '9 '
      ];

      var expected = [
        '2 ',
        '3 ',
        '4 ',
        '5 ',
        '6 ',
        '7 ',
        '8',
      ].join('')

      handler.register('/xfoo', {}, stream);

      function writeStream() {
        var chunk = chunks.shift();
        if (!chunk) return;
        stream.write(chunk);
        // Next tick implies here is a write
        process.nextTick(writeStream);
      }

      var options = URL.parse(url + '/xfoo');
      options.headers = {
        // Note that per rfc7233 byte ranges are inclusive which may not be what
        // you expected !
        'Range': 'bytes=2-14'
      };

      var req = http.get(options);

      // Ensure it can be read out.
      req.once('response', function(res) {
        var buffer = '';
        res.on('data', function gotData(data) {
          buffer += data;
          console.log(buffer);
          if (buffer === expected) {
            res.removeListener('data', gotData);
            stream.end();
            res.once('end', done);
          }
        });
      });
      req.end();

      // Kick off the writes to the stream...
      writeStream();
    });

    test('range: start no end', function(done) {
      // Create a stream endpoint...
      var stream = new PassThrough();
      var chunks = [
        '1 ',
        '2 ',
        '3 ',
        '4 ',
        '5 ',
        '6 ',
        '7 ',
        '8 ',
        '9 '
      ];

      var expected = [
        '2 ',
        '3 ',
        '4 ',
        '5 ',
        '6 ',
        '7 ',
        '8 ',
        '9 ',
      ].join('')

      handler.register('/xfoo', {}, stream);

      function writeStream() {
        var chunk = chunks.shift();
        if (!chunk) return;
        stream.write(chunk);
        // Next tick implies here is a write
        process.nextTick(writeStream);
      }

      var options = URL.parse(url + '/xfoo');
      options.headers = {
        // Note that per rfc7233 byte ranges are inclusive which may not be what
        // you expected !
        'Range': 'bytes=2-'
      };

      var req = http.get(options);

      // Ensure it can be read out.
      req.once('response', function(res) {
        var buffer = '';
        res.on('data', function gotData(data) {
          buffer += data;
          if (buffer === expected) {
            res.removeListener('data', gotData);
            stream.end();
            res.once('end', done);
          }
        });
      });
      req.end();

      // Kick off the writes to the stream...
      writeStream();
    });

    test('range: end no start', function(done) {
      // Create a stream endpoint...
      var stream = new PassThrough();
      var chunks = [
        '1 ',
        '2 ',
        '3 ',
        '4 ',
        '5 ',
        '6 ',
        '7 ',
        '8 ',
        '9 '
      ];

      var expected = [
        '1 '
      ].join('')

      handler.register('/xfoo', {}, stream);

      function writeStream() {
        var chunk = chunks.shift();
        if (!chunk) return;
        stream.write(chunk);
        // Next tick implies here is a write
        process.nextTick(writeStream);
      }

      var options = URL.parse(url + '/xfoo');
      options.headers = {
        // Note that per rfc7233 byte ranges are inclusive which may not be what
        // you expected !
        'Range': 'bytes=-1'
      };

      var req = http.get(options);

      // Ensure it can be read out.
      req.once('response', function(res) {
        var buffer = '';
        res.on('data', function gotData(data) {
          buffer += data;
          if (buffer === expected) {
            res.removeListener('data', gotData);
            stream.end();
            res.once('end', done);
          }
        });
      });
      req.end();

      // Kick off the writes to the stream...
      writeStream();
    });

  });

});
