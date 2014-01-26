/* Dogetunnel API */

var dbConnectionString = 'postgres://dogetunnel@/dogetunnel';

var express = require('express')
  , app = express()
  , pg = require('pg')
  , PORT = process.env.PORT || 8090
  , EmailSender = require('email').EmailSender
  , Model = require('model');

app.use(express.json());

var client = new pg.Client(dbConnectionString);

/* Mocked email sender */
var email_sender = new EmailSender();

client.connect(function(err) {

  if (err) {
    console.error('Fatal database error', err);
    return process.exit(1);
  }

  var model = new Model(client);

  require('api')(app, model, email_sender);

});

app.listen(PORT);
console.log('Listening on ' + PORT);
