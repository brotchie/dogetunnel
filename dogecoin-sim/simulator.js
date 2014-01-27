#!/usr/bin/env node

/* Parse command line options */
var optimist = require('optimist')
     .usage('$0 test_script')
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

if (argv.help || argv._.length != 1) {
  optimist.showHelp();
  process.exit(0);
}

var fs = require('fs')
  , test_script_path = argv._[0]
  , test_script = JSON.parse(fs.readFileSync(test_script_path));

var jayson = require('jayson')
  , _ = require('lodash');

function simulate(name) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();

    var expected = test_script.shift();

    if (name !== expected.method) {
      console.error('expected', expected.method, JSON.stringify(expected.params));
      process.exit(1);
    }
    if (expected.params && !_.isEqual(args, expected.params)) {
      console.error('expected ' + JSON.stringify(expected.params));
      process.exit(1);
    }
    callback(null, expected.result);
    if (test_script.length == 0) {
      setTimeout(function() {
        process.exit(0);
      }, 100);
    }
  }
}

var server = jayson.server({
  getnewaddress: simulate('getnewaddress'),
  listunspent: simulate('listunspent'),
  gettransaction: simulate('gettransaction')
}, {
  version: 1
});

server.on('request', function(req) {
  console.log(req);
});

server.http().listen(argv.port);
console.log('dogecoind simulated listening on port ' + argv.port);
