suite('server', function() {
  var Handler = require('./server');
  var PassThrough = require('stream').PassThrough;

  var fs = require('fs');
  var http = require('http');
  var fixture = 'test/stream.txt';

  function cleanup() {
    if (fs.existsSync(fixture)) {
      fs.unlinkSync(fixture);
    }
  }

  function createWriteStream() {
    return fs.createWriteStream(fixture);
  }

  // Ensure we are always in a clean state.
  setup(cleanup);
  teardown(cleanup);

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
      var stream = createWriteStream();
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
      handler.add('/xfoo', fixture);

      function writeStream() {
        var chunk = chunks.shift();
        if (!chunk) return;
        stream.write(chunk);
        process.nextTick(writeStream);
      }

      // Ensure it can be read out.
      http.get(url + '/xfoo', function(res) {
        var buffer = '';
        res.on('data', function gotData(data) {
          buffer += data;
          var one = JSON.stringify(buffer.toString());
          var two = JSON.stringify(expected.toString())
          if (buffer === expected) {
            res.removeListener('data', gotData);
            handler.close('/xfoo');
            res.once('end', done);
          }
        });
      }).end();

      // Kick off the writes to the stream...
      writeStream();
    });

    test('single', function(done) {
      // Create a stream endpoint...
      var stream = createWriteStream();
      var expected = 'foobar\nbaz';
      handler.add('/xfoo', fixture);

      // Write some data to the stream...
      stream.write(expected);

      // Ensure it can be read out.
      http.get(url + '/xfoo', function(res) {
        var buffer = '';

        res.on('data', function gotData(data) {
          buffer += data;
          if (buffer === expected) {
            res.removeListener('data', gotData);
            handler.close('/xfoo');
            res.once('end', done);
          }
        });
      }).end();
    });

  });

});
