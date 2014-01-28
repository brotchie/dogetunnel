var async = require('async')
  , _ = require('lodash')
  , log = require('log4js').getLogger('processor');

var REQUIRED_CONFIRMATIONS = 2;

var Processor = function(model) {
  var self = this;

  this.process = function(callback) {
    async.waterfall([
      function(next) {
        self.processUnspent(next);
      },
      function(unspent, next) {
        self.processUnconfirmed(unspent, next);
      }
    ], callback);
  };

  this.createTransaction = function(txid, callback) {
    async.waterfall([
      function(next) {
        model.getChainTransaction(txid, next);
      },
      function(txs, next) {
        async.eachSeries(txs, function(tx, next_each) {
          log.info('createTransaction', 'Creating transaction', tx.public_address, txid, tx.confirmations, tx.amount);
          model.addTransaction(tx.public_address, txid, tx.confirmations, tx.amount, next_each);
        }, next);
      }
    ], callback);
  };

  this.createTransactions = function(txids, callback) {
    log.info('createTransactions', 'Creating', txids.length, 'transactions.');
    async.eachSeries(txids, self.createTransaction, callback);
  };

  /* Finds new unspent transactions. Returns the list
   * of unspent transactions to callback. */
  this.processUnspent = function(callback) {
    async.waterfall([
      /* Fetch all the unspent transactions from dogecoind. */
      function(next) {
        model.getUnspentChainTransactions(next);
      },
      /* Fetch all these transactions from the database. */
      function(unspent, next) {
        log.info('processUnspent', 'Processing', unspent.length, 'unspent transactions');
        var txids = _.pluck(unspent, 'txid');
        model.getTransactions(txids, function(err, txs) {
          if (err) {
            log.error('processUnspent', 'getTransactions failed', err.message);
            next(err);
          } else {
            next(null, unspent, txs);
          }
        });
      },
      function(unspent, txs, next) {
        var unspent_txids = _.pluck(unspent, 'txid')
          , seen_txids    = _.unique(_.pluck(txs, 'txid'))
          , unseen_txids  = _.difference(unspent_txids, seen_txids);
        self.createTransactions(unseen_txids, function(err) {
          if (err) {
            log.error('processUnspent', 'createTransactions failed', err.message);
            next(err);
          } else {
            next(null, unspent);
          }
        });
      }
    ], callback);
  };

  this.confirmTransaction = function(txid, callback) {
    async.waterfall([
        function(next) {
          model.getChainTransaction(txid, next);
        },
        function(txs, next) {
          async.eachSeries(txs, function(tx, next_each) {
            model.confirmTransaction(tx.public_address, txid, tx.confirmations, next_each);
          }, next);
        }
    ], callback);
  };

  this.confirmTransactions = function(txids, callback) {
    async.eachSeries(txids, self.confirmTransaction, callback);
  };

  this.processUnconfirmed = function(unspent, callback) {
    log.info('processUnconfirmed', 'Processing unconfirmed with', unspent.length, 'unspent transactions.');
    var unspent_map = _.chain(unspent)
          .map(function(tx) {
            return [tx.txid, tx];
          })
          .object()
          .value();

    async.waterfall([
      function(next) {
        model.getTransactionIdentifiersInState(model.UNCONFIRMED, next);
      },
      function(unconfirmed, next) {
        log.info('processUnconfirmed', 'Processing', unconfirmed.length, 'unconfirmed transactions.');
        async.eachSeries(unconfirmed, function(txid) {
          if (unspent_map[txid] && 
              unspent_map[txid].confirmations >= REQUIRED_CONFIRMATIONS) {
            log.info('processUnconfirmed', 'Confirming', txid);
            self.confirmTransaction(txid, next);
          } else if (unspent_map[txid]) {
            log.info('processUnconfirmed', 'Unconfirmed transaction', txid, 'only has', unspent_map[txid].confirmations, 'confirmations.');
            next();
          } else {
            log.warn('processUnconfirmed', 'Unconfirmed transaction', unconfirmed, 'was not found in unspent transactions.');
            next();
          }
        });
      }
    ], callback);
  };
};


module.exports = Processor;
