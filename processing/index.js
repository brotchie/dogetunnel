#!/usr/bin/env node

var pg = require('pg'),
    async = require('async'),
    log4js = require('log4js'),
    log = log4js.getLogger(),
    read = require('read');

var optimist = require('optimist')
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
    .options('passphrase', {
       description: 'Wallet passphrase. DO NOT USE THIS IN PRODUCTION!'
    })
    .options('pollperiod', {
      description: 'Number of seconds between checkin for new transactions.',
      default: 10
    })
    .options('keypoolperiod', {
      description: 'Number of seconds between checking the size of the key pool.', 
      default: 30
    })
    .options('keypoolthreshold', {
      description: 'Threshold where the key pool is refilled.',
      default: 50
    })
    .options('keypoolunlocktime', {
      description: 'Length of time (in seconds) the wallet is unlocked for key pool refill.',
      default: 5
    })
  , argv = optimist.argv;

if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

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

    dogecoin.walletPassphrase(passphrase, 1, function(err) {
      if (err) {
        next(err);
      } else {
        next(null, passphrase, dogecoin);
      }
    });
  }], function(err, passphrase, dogecoin) {
    if (err) {
      log.fatal(err.message);
      process.exit(1);
    }

    log.info('Dogetunnel payment processor started.');

    var Model = require('model')
      , Processor = require('processor');

    var client = new pg.Client(argv.dbstring);

    
    client.connect(function(err) {
      if (err) {
        console.error('Fatal database error', err);
        return process.exit(1);
      }

      var model = new Model(client, dogecoin)
        , processor = new Processor(model);


      var PROCESSOR_POLL_PERIOD = argv.pollperiod * 1000;
      /* The main processor loop. */
      (function main(){
        processor.process(function(err) {
          if (err) {
            throw err;
          } else {
            setTimeout(main, PROCESSOR_POLL_PERIOD);
          }
        });
      })();

      /* How often we check the size of the key pool. */
      var KEY_POOL_POLL_PERIOD = argv.keypoolperiod * 1000;

      /* If the size of the keypool drops below this
       * threshold we attempt to refill it. */
      var KEY_POOL_REFILL_THRESHOLD = argv.keypoolthreshold;

      /* Length of time to unlock the wallet for wen
       * refilling the key pool. */
      var KEY_POOL_REFILL_WALLET_UNLOCK_TIME = argv.keypoolunlocktime;

      function refillKeyPool(callback) {
        async.waterfall([
            function(next) {
              dogecoin.walletPassphrase(passphrase, KEY_POOL_REFILL_WALLET_UNLOCK_TIME, next);
            },
            function(result, next) {
              dogecoin.keyPoolRefill(next);
            }
        ], callback);
      }

      (function keyPoolMonitor(){
        async.waterfall([
          function(next) {
            dogecoin.getInfo(next);
          },
          function(info, next) {
            if (info.keypoolsize < KEY_POOL_REFILL_THRESHOLD) {
              log.info('keyPoolMonitor', 'Key pool size', info.keypoolsize + ', refilling pool.');
              refillKeyPool(next);
            } else {
              log.debug('keyPoolMonitor', 'Key pool size', info.keypoolsize);
              next();
            }
          }
        ], function(err) {
          if (err) {
            log.error('keyPoolMonitor', err.message);
          } 
          setTimeout(keyPoolMonitor, KEY_POOL_POLL_PERIOD);
        });
      })();
    });
});

process.on('exit', function(code) {
  if (code === 0) {
    log.info('Dogetunnel payment processor stopped normally.');
  } else {
    log.error('Dogetunnel payment processor stopped with exit code ' + code + '.');
  }
});

process.on('SIGINT', function() {
  log.error('Dogetunnel payment processor killed by SIGINT.');
  process.exit(1);
});
