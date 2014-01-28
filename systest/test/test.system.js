var assert = require('assert')
  , sinon = require('sinon');

var pg = require('pg')
  , async = require('async');

var Processor = require('processing/processor')
  , Model = require('processing/model')
  , Simulator = require('dogecoin-sim/simulator');

var TEST_DB_STRING = 'postgres://dogetunnel@/dogetunneltest'
  , TEST_DOGECOIND_PORT = 454546;

var DEFAULT_PUBLIC_ADDRESS = 'DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC';

var dogecoin = require('node-dogecoin')({
  user: 'dogecoin',
  pass: 'dogecoin',
  port: TEST_DOGECOIND_PORT,
  headers: {
    'Content-Type': 'application/json'
  }
});

describe('System Tests', function() {
  beforeEach(function(done) {
    this.client = new pg.Client(TEST_DB_STRING);
    this.simulator = new Simulator();
    this.model = new Model(this.client, dogecoin);
    this.processor = new Processor(this.model);

    var self = this;
    async.waterfall([
      function(next) {
        self.client.connect(next);
      }, 
      function(_, next) {
        self.client.query('TRUNCATE account * CASCADE;', next);
      },
      function(_, next) {
        self.client.query('INSERT INTO account (public_address, password_hash) VALUES ($1, $2)', [DEFAULT_PUBLIC_ADDRESS, 'password'], next);
      },
      function(_, next) {
        self.simulator.listen(TEST_DOGECOIND_PORT, next);
      }
    ], done);
  });

  afterEach(function() {
    this.client.end();
    this.simulator.close();
  });

  it('should handle a complete transaction flow', function(done) {
    var processor = this.processor
      , client = this.client;

    var txid = '49af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c';
    this.simulator.setScript('scripts/processor-flow.json');

    async.waterfall([
      function(next) {
        processor.process(next);
      },
      function(next) {
        processor.process(next);
      },
      function(next) {
        client.query('SELECT * FROM transaction WHERE public_address=$1 AND txid=$2;', [DEFAULT_PUBLIC_ADDRESS, txid], next); 
      },
      function(data, next) {
        var tx = data.rows[0];
        assert.equal(tx.state, 'confirmed');
        assert.equal(tx.confirmations, 4);
        next();
      }
    ], done);
  });
});
