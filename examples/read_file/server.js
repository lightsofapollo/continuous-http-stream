var http = require('http');
var fs = require('fs');

var Handler = require('../../server')
var handler = new Handler();

var file = __dirname + '/out.txt';
var server = http.createServer(handler.callback());
handler.add('/file', file);
server.listen(60023);
console.log(
  'serving from: http://localhost:' + server.address().port + '/file'
);
