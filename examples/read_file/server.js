var startMem = process.memoryUsage();

var bytes = require('bytes');
var http = require('http');
var fs = require('fs');

var Handler = require('../../server')
var PassThrough = require('stream').PassThrough;
var handler = new Handler();

var file = __dirname + '/out.txt';
if (fs.existsSync(file)) fs.unlinkSync(file);

var stream = new PassThrough();
var chunk = 0;

setInterval(function() {
  var usage = process.memoryUsage();
  console.log('usage: ', {
    rss: bytes(usage.rss - startMem.rss),
    heapTotal: bytes(usage.heapTotal - startMem.heapTotal),
    heapUsed: bytes(usage.heapUsed - startMem.heapUsed),
  });
}, 1000);

setInterval(function() {
  stream.write('#### CHUNK ' + (chunk++) + ' ####');
}, 200);

var server = http.createServer(handler.callback());
handler.register('/file', { 'content-type': 'text/plain; charset=UTF-8' }, stream);
server.listen(60023);
console.log(
  'serving from: http://localhost:' + server.address().port + '/file'
);

