#!/usr/bin/env node
/* Dogetunnel API */

var optimist = require('optimist')
    .options('h', {
       alias: 'help',
       description: 'Show help'
    })
    .options('p', {
      alias: 'port',
      description: 'HTTP port to listen on',
      default: 8090
    })
    .options('dogepass', {
       description: 'JSON-RPC Password',
       default: 'dogetunnel'
    })
    .options('dogeuser', {
       description: 'JSON-RPC Username',
       default: 'dogetunnel'
    })
    .options('dogeport', {
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

var pg = require('pg');

var dogecoin = require('node-dogecoin')({
  user: argv.dogeuser,
  pass: argv.dogepass,
  port: argv.dogeport
  /*headers: {
    'Content-Type': 'application/json'
  }*/
});

var express = require('express')
  , app = express();

var EmailSender = require('email').EmailSender
  , Model = require('model');

app.use(express.json());

var client = new pg.Client(argv.dbstring);

/* Mocked email sender */
var email_sender = new EmailSender();

client.connect(function(err) {

  if (err) {
    console.error('Fatal database error', err);
    return process.exit(1);
  }

  var model = new Model(client, dogecoin);

  require('api')(app, model, email_sender);

});

app.listen(argv.port);
console.log('Listening on ' + argv.port);
