var startMem = process.memoryUsage();
var fs = require('fs');
var bytes = require('bytes');

if (fs.existsSync('target.out')) {
  fs.unlinkSync('target.out');
}


var stream = fs.createWriteStream('target.out');

var lorem = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
var chunk = 0;

function write() {
  var content = '## CHUNK ' + (chunk++) + '##\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                lorem + '\r\n' +
                '## CHUNK ' + chunk + '##\r\n';

  console.log('usage rss: ', bytes(process.memoryUsage().rss - startMem.rss));
  console.log('usage heap used: ', bytes(process.memoryUsage().heapUsed - startMem.heapUsed));
  console.log('usage heap total: ', bytes(process.memoryUsage().heapTotal - startMem.heapTotal));

  console.log('write!!');
  if (stream.write(content)) {
    setTimeout(write, 750);
  } else {
    console.log('wait for drain');
    stream.once('drain', function() {
      console.log('write!!');
      setTimeout(write, 100);
    });
  }
}

write();
