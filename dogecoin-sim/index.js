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
