suite('server', function() {
  var Handler = require('./server');
  var PassThrough = require('stream').PassThrough;
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
      ]
      var expected = chunks.join('');

      handler.addStream('/xfoo', stream);

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
            done();
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
      handler.addStream('/xfoo', stream);

      // Write some data to the stream...
      stream.write(expected);

      // Ensure it can be read out.
      http.get(url + '/xfoo', function(res) {
        var buffer = '';

        res.on('data', function gotData(data) {
          buffer += data;
          if (buffer === expected) {
            res.removeListener('data', gotData);
            done();
          }
        });
      }).end();
    });

  });

});