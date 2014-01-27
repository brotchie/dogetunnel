var _ = require('lodash');
/* Model constructor. Needs a pg postgresql client instance. */
var Model = function(client, dogecoin) {
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
  }
}

module.exports = Model;
