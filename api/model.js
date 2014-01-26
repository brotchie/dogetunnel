var bcrypt = require('bcrypt')
  //, dogecoin = require('dogecoin')
  , async = require('async');

var MINIMUM_PASSWORD_LENGTH = 6;
var WALLET_ACCOUNT_PREFIX = 'DT';

var wallet_account_from_account_id = function(account_id) {
  return WALLET_ACCOUNT_PREFIX + account_id;
};

var hash_password = function(password, callback) {
  async.waterfall([
      bcrypt.genSalt,
      function(salt, next) {
        bcrypt.hash(password, salt, next);
      }
  ], callback);
}

/* Requires pg client instance. */
var Model = function(client) {
  this.client = client;
};

Model.prototype.create_account = function(password, ip_address, callback) {

  var client = this.client;

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return callback(new Error('password too short'));
  }

  async.waterfall([
      function(next) {
        hash_password(password, next);
      },
      function(password_hash, next) {
        client.query('INSERT INTO account (password_hash, ip_address) VALUES ($1, $2) RETURNING account_id',
                     [password_hash, ip_address], function(err, data) {
          if (err) {
            next(err);
          } else {
            var account_id = data.rows[0].account_id;
            next(null, account_id);
          }
        });
      },
      function(account_id, next) {
        // TODO: call dogecoind new ccount with 'dt' + account_id;
        var account = wallet_account_from_account_id(account_id);
        //dogecoin.createaccount(account);
        next(null, '1234');
      }
  ], function(err, public_address) {
    callback(err, public_address);
  });
};

Model.prototype.set_account_email = function(public_address, password, email, callback) {
  client.query('SELECT password_hash FROM account WHERE public_address=$1', [public_address], function(err, data) {

  });
};
Model.prototype.get_account_balance = function(public_address, password, callback) {
};
Model.prototype.request_password_reset = function(public_address, callback) {};
Model.prototype.reset_password = function(public_address, new_password, nonce, callback) {};

module.exports = Model;