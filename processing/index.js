#!/usr/bin/env node

var pg = require('pg');

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
    , procesor = new Processor(model);

  model.get_unspent_transactions(function(err, unspent) {
    console.log(unspent);
  });
});
  

