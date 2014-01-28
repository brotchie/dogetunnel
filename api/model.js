var bcrypt = require('bcrypt')
  //, dogecoin = require('dogecoin')
  , async = require('async');

var MINIMUM_PASSWORD_LENGTH = 6;
var WALLET_ACCOUNT_PREFIX = 'DT';

var hash_password = function(password, callback) {
  async.waterfall([
      bcrypt.genSalt,
      function(salt, next) {
        bcrypt.hash(password, salt, next);
      }
  ], callback);
}

/* Requires pg client instance. */
var Model = function(client, dogecoin) {
  this.client = client;
  this.dogecoin = dogecoin;
};

Model.prototype.create_account = function(password, ip_address, callback) {

  var client = this.client
    , dogecoin = this.dogecoin;

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return callback(new Error('password too short'));
  }

  async.waterfall([
      function(next) {
        async.parallel([
          function(next_parallel) {
            hash_password(password, next_parallel);
          },
          function(next_parallel) {
            dogecoin.getNewAddress(next_parallel);
          }
        ], next);
      },
      function(tuple, next) {
        var password_hash = tuple[0]
          , public_address = tuple[1];
        client.query('INSERT INTO account (password_hash, ip_address, public_address) VALUES ($1, $2, $3)',
                     [password_hash, ip_address, public_address],
                     function(err) {
                       if (err) {
                         next(err);
                       } else {
                         next(null, public_address);
                       }
                     })
      },
      function(public_address, next) {
        dogecoin.setAccount(public_address, public_address, function(err) {
          if (err) {
            next(err);
          } else {
            next(null, public_address);
          }
        });
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
