var async = require('async')
  , _ = require('lodash')
  , log = require('log4js').getLogger('processor');

var REQUIRED_CONFIRMATIONS = 2
  , KBYTES_PER_DOGE = 1000;

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
        model.getUnspentChainTransactions(next);
      },
      /* Fetch all these transactions from the database. */
      function(unspent, next) {
        log.debug('processUnspent', 'Processing', unspent.length, 'unspent transactions');
        var txids = _.unique(_.pluck(unspent, 'txid'));
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
        var seen_map = build_txid_vout_map(txs);

        async.eachSeries(unspent, function(tx, next_each) {
          var txid = tx.txid
            , vout = tx.vout;
          if (!seen_map[txid] || !seen_map[txid][vout]) {
            var public_address = tx.scriptPubKey.addresses[0];
            model.addTransaction(public_address, txid, vout, tx.confirmations, tx.amount, next_each);
          } else {
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
};


module.exports = Processor;
