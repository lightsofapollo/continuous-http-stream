var fs = require('fs');
var file = __dirname + '/out.txt';
if (fs.existsSync(file)) fs.unlinkSync(file);
var stream = fs.createWriteStream(file);
var chunk = 0;
setInterval(function() {
  stream.write('#### CHUNK ' + (chunk++) + ' ####');
}, 750);
