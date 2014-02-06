#!/usr/bin/env node

var pg = require('pg')
  , async = require('async')
  , log4js = require('log4js')
  , log = log4js.getLogger()
  , read = require('read')
  , _ = require('lodash');

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

function promptForWalletPassphrase(next) {
  if (argv.pasphrase) {
    next(null, argv.passphrase);
  } else {
    read({
      prompt: 'dogecoind wallet passphrase: ',
      silent: true,
      replace: '*'
    }, function(err, passphrase) {
      if (err) {
        next(err);
      } else {
        next(null, passphrase);
      }
    })
  }
}

function initDogecoinRPC(passphrase, next) {
  var dogecoin = require('node-dogecoin')({
    user: argv.dogeuser,
    pass: argv.dogepass,
    port: argv.dogeport,
    passphrasecallback: function(command, args, callback) {
      callback(null, passphrase, 300);
    }
  });

  next(null, dogecoin);
}

var confirm = true;

async.waterfall([
    promptForWalletPassphrase,
    initDogecoinRPC
  ], function(err, dogecoin) {

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

      function confirmWithUser(inputs, outputs, total, next) {
        log.info('inputs', inputs);
        log.info('outputs', outputs);
        log.info('total', total, 'fee', TXFEE, 'net', total - TXFEE);
        log.info('send to', targetAddress);
        read({
          prompt: 'Is this ok? [all/yes/no]',
          default: 'yes'
        }, function(err, response) {
          if (response === 'yes' || response === 'all') {
            confirm = response !== 'all';
            next(null, inputs, outputs);
          } else {
            next(new Error('aborted'));
          }
        });
      }

      function spendTransactions(txs, callback) {
        var total = _.reduce(txs, function(sum, tx) {
          return sum + Number(tx.amount);
        }, 0);

        var inputs = _.map(txs, function(tx) {
          return {
            txid: tx.txid,
            vout: Number(tx.vout),
            public_address: tx.public_address
          };
        });

        var outputs = {};
        outputs[targetAddress] = total - TXFEE;

        async.waterfall([
          function(next) {
            if (confirm) {
              confirmWithUser(inputs, outputs, total, next);
            } else {
              next(null, inputs, outputs);
            }
          },
          function(inputs, outputs, next) {
            model.sendRawTransaction(inputs, outputs, next);
          },
          function(sent_txid, inputs, outputs, next) {
            log.info('Sent txid', sent_txid);
            async.eachSeries(inputs, function(tx, next_each) {
              log.info('Updating', tx, 'to spent.');
              model.spendTransaction(tx.public_address, tx.txid, tx.vout, sent_txid, next_each);
            }, next);
          }
        ], callback);
      }

      async.waterfall([
        function(next) {
          model.getTransactionsInState(model.CREDITED, next);
        },
        function(credited, next) {
          async.whilst(
            function() { return credited.length > 0; },
            function(next_whilst) {
              var txs = credited.splice(0, 64);
              spendTransactions(txs, next_whilst);
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



