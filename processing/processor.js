var async = require('async')
  , _ = require('lodash')
  , log = require('log4js').getLogger('processor');

var REQUIRED_CONFIRMATIONS = 2
  , KBYTES_PER_DOGE = 1000
  , COLD_WALLET_PUBLIC_ADDRESS = 'norgd1AJvZt5xkFMyX8VWUVJoFM3PhGueL'
  , TRANSACTION_FEE = 1;

var Processor = function(model) {
  var self = this;

  this.process = function(callback) {
    async.waterfall([
      function(next) {
        self.processUnspent(next);
      },
      function(unspent, next) {
        self.processUnconfirmed(unspent, next);
      },
      function(next) {
        self.processConfirmed(next);
      }
/*      function(next) {
        self.processCredited(next);
      }*/
    ], callback);
  };


  function build_txid_vout_map(items) {
    return _.chain(items)
      .groupBy('txid')
      .mapValues(function(item) {
        return _.zipObject(_.pluck(item, 'vout'), item);
      })
      .value();
  }

  /* Finds new unspent transactions. Returns the list
   * of unspent transactions to callback. */
  this.processUnspent = function(callback) {
    async.waterfall([
      /* Fetch all the unspent transactions from dogecoind. */
      function(next) {
        log.debug('processUnspent', 'Fetching unspent transactions.');
        model.getUnspentChainTransactions(next);
      },
      /* Fetch all these transactions from the database. */
      function(unspent, next) {
        log.debug('processUnspent', 'Processing', unspent.length, 'unspent transactions');

        var transactions = _.map(unspent, function(tx) {
          return {
            public_address: tx.scriptPubKey.addresses[0],
            txid: tx.txid,
            vout: tx.vout
          };
        });

        log.debug('processUnspent', 'Getting new transactions.');
        model.getNewTransactions(transactions, function(err, newtxs) {
          if (err) {
            log.error('processUnspent', 'getTransactions failed', err.message);
            next(err);
          } else {
            next(null, unspent, newtxs);
          }
        });
      },
      function(unspent, newtxs, next) {
        log.info('processUnspent', 'Adding', newtxs.length, 'new transactions.');

        var txlookup = _.chain(unspent)
              .map(function(tx) {
                return [tx.scriptPubKey.addresses[0] + '_' + tx.txid + '_' + tx.vout, tx];
              })
              .object()
              .value();

        async.eachSeries(newtxs, function(tx, next_each) {
          var key = tx.public_address + '_' + tx.txid + '_' + tx.vout
            , unspent_tx = txlookup[key];
          if (unspent_tx) {
            log.info('processUnspent', 'Adding transaction', unspent_tx);
            model.addTransaction(tx.public_address, tx.txid, tx.vout, unspent_tx.confirmations, unspent_tx.amount, next_each);
          } else {
            log.error('processUnspent', 'Transaction not found', tx);
            next_each();
          }
        }, function(err) {
          if (err) {
            next(err);
          } else {
            next(null, unspent);
          }
        });
      }
    ], callback);
  };

  this.processUnconfirmed = function(unspent, callback) {
    log.debug('processUnconfirmed', 'Processing unconfirmed with', unspent.length, 'unspent transactions.');
    var unspent_map = build_txid_vout_map(unspent);

    async.waterfall([
      function(next) {
        model.getTransactionsInState(model.UNCONFIRMED, next);
      },
      function(unconfirmed, next) {
        log.debug('processUnconfirmed', 'Processing', unconfirmed.length, 'unconfirmed transactions.');
        async.eachSeries(unconfirmed, function(tx, next_each) {
          if (unspent_map[tx.txid] &&
              unspent_map[tx.txid][tx.vout] &&
              unspent_map[tx.txid][tx.vout].confirmations >= REQUIRED_CONFIRMATIONS) {
            log.info('processUnconfirmed', 'Confirming', tx.txid, tx.vout);
            var confirmations = unspent_map[tx.txid][tx.vout].confirmations;
            model.confirmTransaction(tx.public_address, tx.txid, tx.vout, confirmations, next_each);
          } else if (unspent_map[tx.txid] &&
                     unspent_map[tx.txid][tx.vout]) {
            log.info('processUnconfirmed', 'Unconfirmed transaction', tx.txid, 'only has', unspent_map[tx.txid][tx.vout].confirmations, 'confirmations.');
            next_each();
          } else {
            log.warn('processUnconfirmed', 'Unconfirmed transaction', unconfirmed, 'was not found in unspent transactions.');
            next_each();
          }
        }, next);
      }
    ], callback);
  };

  this.creditTransaction = function(tx, callback) {
    model.creditTransaction(tx.public_address, tx.txid, tx.vout, KBYTES_PER_DOGE, callback);
  };

  this.creditTransactions = function(confirmed, callback) {
    async.eachSeries(confirmed, self.creditTransaction, callback);
  };

  this.processConfirmed = function(callback) {
    var self = this;

    async.waterfall([
      function(next) {
        model.getTransactionsInState(model.CONFIRMED, next);
      },
      function(confirmed, next) {
        log.debug('processConfirmed', 'Processing', confirmed.length, 'confirmed transactions.');
        self.creditTransactions(confirmed, next);
      }
    ], callback);
  };

  this.processCredited = function(callback) {
    async.waterfall([
      function(next) {
        model.getTransactionsInState(model.CREDITED, next);
      },
      function(credited, next) {
        var total = _.reduce(credited, function(sum, tx) {
          return sum + Number(tx.amount);
        }, 0);
        log.info('processCredited', total, 'unspent');
        if (total > 500) {
          var inputs = _.map(credited, function(tx) {
            return {txid: tx.txid, vout: Number(tx.vout)};
          });
          var outputs = {};
          outputs[COLD_WALLET_PUBLIC_ADDRESS] = total - TRANSACTION_FEE;

          console.log(inputs, outputs);

          model.sendRawTransaction(inputs, outputs, function(err, hex) {
            console.log(err, hex);
            next();
          });
        } else {
          next();
        }
      }
    ], callback);
  };
};


module.exports = Processor;
