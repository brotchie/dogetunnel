#!/usr/bin/env node

/* Parse command line options */
var optimist = require('optimist')
     .options('h', {
       alias: 'help',
       description: 'Show help'
     })
     .options('p', {
       alias: 'port',
       description: 'JSON-RPC Port',
       default: 44556
     })
  , argv = optimist.argv;

if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

var jayson = require('jayson');

var server = jayson.server({
  getbalance: function(callback) {
    callback(null, 1234);
  }
}, {
  version: 1
});

server.on('request', function(req) {
  console.log(req);
});

server.http().listen(argv.port);
console.log('dogecoind simulated listening on port ' + argv.port);
