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
  stream.write('#### CHUNK ' + (chunk++) + ' ####');
}, 750);

var server = http.createServer(handler.callback());
handler.register('/file', { 'content-type': 'text/plain; charset=UTF-8' }, stream);
server.listen(60023);
console.log(
  'serving from: http://localhost:' + server.address().port + '/file'
);

