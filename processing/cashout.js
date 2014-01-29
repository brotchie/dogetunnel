#!/usr/bin/env node

var pg = require('pg')
  , async = require('async')
  , log4js = require('log4js')
  , log = log4js.getLogger()
  , read = require('read')
  , _ = require('lodash');

var RPC_WALLET_ALREADY_UNLOCKED = -17;

var optimist = require('optimist')
    .usage('$0 target_address')
    .options('h', {
       alias: 'help',
       description: 'Show help'
    })
    .options('dogepass', {
       description: 'JSON-RPC Password',
       default: 'dogetunnel'
    })
    .options('dogeuser', {
       description: 'JSON-RPC Username',
       default: 'dogetunnel'
    })
    .options('p', {
       alias: 'dogeport',
       description: 'JSON-RPC Port',
       default: 44556
    })
    .options('d', {
       alias: 'dbstring',
       description: 'Connection string for the dogetunnel Postgres database',
       default: 'postgres://dogetunnel@/dogetunnel'
    })
    .options('txfee', {
      description: 'Size of transaction fee',
      default: 1
    })
  , argv = optimist.argv;

if (argv.help || argv._.length != 1) {
  optimist.showHelp();
  process.exit(0);
}

var targetAddress = argv._[0];
log.info('Starting cash out process to address', targetAddress);

var client = new pg.Client(argv.dbstring);

async.waterfall([
  function promptForWalletPassphrase(next) {
    if (argv.pasphrase) {
      next(null, argv.passphrase);
    } else {
      read({
        prompt: 'dogecoind wallet passphrase: ',
        silent: true,
        replace: '*'
      }, next);
    }
  },
  /* Try unlocking the wallet */
  function attemptWalletUnlock(passphrase, isDefault, next) {
    var dogecoin = require('node-dogecoin')({
      user: argv.dogeuser,
      pass: argv.dogepass,
      port: argv.dogeport
      /*headers: {
        'Content-Type': 'application/json'
      }*/
    });

    dogecoin.walletPassphrase(passphrase, 30, function(err) {
      if (!err || err.code == RPC_WALLET_ALREADY_UNLOCKED) {
        next(null, passphrase, dogecoin);
      } else {
        next(err);
      }
    });
  }], function(err, passphrase, dogecoin) {

    if (err) {
      log.fatal(err.message);
      process.exit(1);
    }

    client.connect(function(err) {
      if (err) {
        log.fatal('Fatal database error', err);
        process.exit(1);
      }

      var Model = require('model')
        , model = new Model(client, dogecoin);

      var TXFEE = argv.txfee;

      async.waterfall([
        function fetchCreditedTransactions(next) {
          model.getTransactionsInState(model.CREDITED, next);
        },
        function constructRawTransaction(credited, next) {
          var total = _.reduce(credited, function(sum, tx) {
            return sum + Number(tx.amount);
          }, 0);

          var inputs = _.map(credited, function(tx) {
            return {
              txid: tx.txid,
              vout: Number(tx.vout),
              public_address: tx.public_address
            };
          });

          var outputs = {};
          outputs[targetAddress] = total - TXFEE;

          next(null, inputs, outputs, total);
        },
        function confirmWithUser(inputs, outputs, total, next) {
          log.info('inputs', inputs);
          log.info('outputs', outputs);
          log.info('total', total, 'fee', TXFEE, 'net', total - TXFEE);
          log.info('send to', targetAddress);
          read({
            prompt: 'Is this ok? [no]'
          }, function(err, response) {
            if (response === 'yes') {
              next(null, inputs, outputs);
            } else {
              next(new Error('aborted'));
            }
          });
        },
        function signAndSendTransaction(inputs, outputs, next) {
          model.sendRawTransaction(inputs, outputs, next);
        },
        function updateDatabase(sent_txid, inputs, outputs, next) {
          log.info('Sent txid', sent_txid);
          async.eachSeries(inputs, function(tx, next_each) {
            log.info('Updating', tx, 'to spent.');
            model.spendTransaction(tx.public_address, tx.txid, tx.vout, sent_txid, next_each);
          }, next);
        }
      ], function(err) {
        if (err) {
          log.fatal(err.message);
          process.exit(1);
        } else {
          process.exit(0);
        }
      });
    });

  }
);



