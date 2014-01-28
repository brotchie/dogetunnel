var async = require('async')
  , _ = require('lodash');

var Processor = function(model) {
  var self = this;
  this.process = function(callback) {
  };

  this.createTransaction = function(txid, callback) {
    async.waterfall([
      function(next) {
        model.getChainTransaction(txid, next);
      },
      function(tx, next) {
        model.addTransaction(tx.public_address, txid, tx.confirmations, tx.amount, next);
      }
    ], callback);
  };

  this.createTransactions = function(txids, callback) {
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
        var txids = _.pluck(unspent, 'txid');
        model.getTransactions(txids, function(err, txs) {
          if (err) {
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
            next(err);
          } else {
            next(null, unspent);
          }
        });
      }
    ], callback);
  };

  
};


module.exports = Processor;
