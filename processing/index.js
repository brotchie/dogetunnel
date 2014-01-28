#!/usr/bin/env node

var pg = require('pg'),
    async = require('async'),
    log4js = require('log4js'),
    log = log4js.getLogger();

var optimist = require('optimist')
    .options('h', {
       alias: 'help',
       description: 'Show help'
    })
    .options('dogepass', {
       description: 'JSON-RPC Password',
       default: 'dogetunnel'
    })
    .options('dogeuser', {
       description: 'JSON-RPC Username',
       default: 'dogetunnel'
    })
    .options('p', {
       alias: 'dogeport',
       description: 'JSON-RPC Port',
       default: 44556
    })
    .options('d', {
       alias: 'dbstring',
       description: 'Connection string for the dogetunnel Postgres database',
       default: 'postgres://dogetunnel@/dogetunnel'
    })
  , argv = optimist.argv;

if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

log.info('Dogetunnel payment processor started.');

var Model = require('model')
  , Processor = require('processor');

var client = new pg.Client(argv.dbstring);

var dogecoin = require('node-dogecoin')({
  user: argv.dogeuser,
  pass: argv.dogepass,
  port: argv.dogeport,
  headers: {
    'Content-Type': 'application/json'
  }
});

client.connect(function(err) {
  if (err) {
    console.error('Fatal database error', err);
    return process.exit(1);
  }

  var model = new Model(client, dogecoin)
    , processor = new Processor(model);

  async.waterfall([
    function(next) {
      processor.processUnspent(next);
    },
    function(unspent, next) {
      processor.processUnconfirmed(unspent, next);
    }
  ], function(err) {
    if (err) {
      log.error(err.message);
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
});

process.on('exit', function(code) {
  if (code === 0) {
    log.info('Dogetunnel payment processor stopped normally.');
  } else {
    log.error('Dogetunnel payment processor stopped with exit code ' + code + '.');
  }
});

process.on('SIGINT', function() {
  log.error('Dogetunnel payment processor killed by SIGINT.');
  process.exit(1);
});
