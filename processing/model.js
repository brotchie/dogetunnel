var _ = require('lodash')
  , async = require('async')
  , log = require('log4js').getLogger('model');

function log_errors(fname, fcn) {
  var args = Array.prototype.slice.call(arguments),
      fcn = args.pop();
  return function(err, callback) {
    if (err) {
      args.push('-');
      args.push(err.message);
      log.error.apply(log, args);
    }
    fcn(err, callback);
  };
};

/* Model constructor. Needs a pg postgresql client instance. */
var Model = function(client, dogecoin) {

  /* Valid transaction states. */
  this.UNCONFIRMED = 'unconfirmed';
  this.CONFIRMED   = 'confirmed';
  this.CREDITED    = 'credited';
  this.SPENT       = 'spent';
  this.COMPLETE    = 'complete';
  this.ERROR       = 'error';

  /* Returns a list of unspent transactions retrieved from
   * dogecoind. Only includes relevant fields: transaction id (txid),
   * amount, and the number of confirmations.
   */
  this.getUnspentChainTransactions = function(callback) {
    dogecoin.listUnspent(0, callback);
  };

  this.sendRawTransaction = function(inputs, outputs, callback) {
    async.waterfall([
      function(next) {
        dogecoin.createRawTransaction(inputs, outputs, next);
      },
      function(hex, next) {
        dogecoin.signRawTransaction(hex, next);
      },
      function(res, next) {
        next(null, res.hex);
      }
    ], callback);
  };

  this.getChainTransaction = function(txid, callback) {
    dogecoin.getTransaction(txid, function(err, res) {
      if (err) {
        log.error('getChainTransaction', err.message);
        callback(err);
      } else {
        callback(null, _.chain(res.details)
          .filter(function(detail) {
            // We only care about recieved funds.
            return detail.category === 'receive';
          })
          .map(function(detail) {
            return {
                public_address: detail.address,
                amount: detail.amount,
                confirmations: res.confirmations
            };
          })
          .value()
        );
      }
    });
  };

  this.getTransactions = function(txids, callback) {
    if (txids.length == 0)
      return callback(null, []);

    var args = _.map(_.range(1, txids.length+1), function(i) {
      return '$' + i;
    }).join(', ');

    client.query('SELECT public_address, txid, vout, confirmations, amount, state FROM transaction WHERE txid IN (' + args + ');', txids, function(err, data) {
      if (err) {
        log.error('getTransactions', err.message);
        callback(err);
      } else {
        callback(null, data.rows);
      }
    });
  };

  this.getTransactionsInState = function(state, callback) {
    client.query('SELECT * FROM transaction WHERE state=$1;', [state], function(err, data) {
      if (err) {
        log.error('getTransactionsInState', state, err.message);
        callback(err);
      } else {
        callback(null, data.rows);
      }
    });
  };

  this.getTransactionIdentifiersInState = function(state, callback) {
    client.query('SELECT DISTINCT txid FROM transaction WHERE state=$1;', [state], function(err, data) {
      if (err) {
        log.error('getTransactionsInState', state, err.message);
        callback(err);
      } else {
        callback(null, _.pluck(data.rows, 'txid'));
      }
    });

  };

  this.confirmTransaction = function(public_address, txid, vout, confirmations, callback) {
    client.query('SELECT transaction_confirm($1, $2, $3, $4);', [public_address, txid, vout, confirmations], log_errors('confirmTransaction', public_address, txid, confirmations, callback));
  };

  this.creditTransaction = function(public_address, txid, vout, multiplier, callback) {
    client.query('SELECT transaction_credit($1, $2, $3, $4);', [public_address, txid, vout, multiplier], log_errors('creditTransaction', public_address, txid, multiplier, callback));
  };

  this.spendTransaction = function(public_address, txid, vout, spent_txid, callback) {
    client.query('SELECT transaction_spend($1, $2, $3, $4);', [public_address, txid, vout, spent_txid], log_errors('spendTransaction', public_address, txid, spent_txid, callback));
  };

  this.completeTransaction = function(public_address, txid, vout, confirmations, callback) {
    client.query('SELECT transaction_complete($1, $2, $3, $4);', [public_address, txid, vout, confirmations], log_errors('completeTransaction', public_address, txid, confirmations, callback));
  };

  this.addTransaction = function(public_address, txid, vout, confirmations, amount, callback) {
    client.query('INSERT INTO transaction (public_address, txid, vout, confirmations, amount) VALUES ($1, $2, $3, $4, $5);', [public_address, txid, vout, confirmations, amount], log_errors('addTransaction', public_address, txid, confirmations, amount, callback));
  };
}

module.exports = Model;
