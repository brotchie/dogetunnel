/* Dogetunnel API */

var express = require('express')
  , app = express()
  , PORT = process.env.PORT || 8090
  , EmailSender = require('email').EmailSender;

app.use(express.json());

/* Mocked email sender */
var email_sender = new EmailSender();

/* Mocked data model (will back on to postgres database) */
var model = {
  create_account: function(password, callback) {
    console.log('Created account with password', password);
    callback(null, 'DKsAEidp7jNWqU5vJG2xfFGWVpabPadd9j');
  },
  set_account_email: function(public_key, password, email, callback) {
    console.log('Set account email', public_key, password, email);
    callback();
  },
  get_account_balance: function(public_key, password, callback) {
    console.log('Retrieved account balance', public_key, password);
    callback(null, 1234);
  },
  request_password_reset: function(public_key, callback) {
    console.log('Requesting password reset', public_key);
    callback();
  },
  reset_password: function(public_key, new_password, nonce, callback) {
    console.log('Resetting password', public_key, new_password, nonce);
    if (new_password.length < 6) {
      callback(new Error('password is too short'));
    } else {
      callback();
    }
  }
};

require('api')(app, model, email_sender);

app.listen(PORT);
console.log('Listening on ' + PORT);
