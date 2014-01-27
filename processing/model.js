var _ = require('lodash');

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
  this.getUnspentTransactions = function(callback) {
    dogecoin.listUnspent(function(err, unspent) {
      if (err) {
        callback(err);
      } else {
        callback(null, _.map(unspent, function(entry) {
          return _.pick(entry, 'txid', 'amount', 'confirmations');
        }));
      }
    });
  };

  this.getTransactions = function(txids, callback) {
    if (txids.length == 0)
      return callback(null, []);

    var args = _.map(_.range(1, txids.length+1), function(i) {
      return '$' + i;
    }).join(', ');

    client.query('SELECT public_address, txid, confirmations, amount, state FROM account, transaction WHERE account.account_id=transaction.account_id AND txid IN (' + args + ');', txids, function(err, data) {
      if (err) {
        callback(err);
      } else {
        callback(null, data.rows);
      }
    });
  };
}

module.exports = Model;
