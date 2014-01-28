var assert = require('assert')
  , sinon = require('sinon');

var Processor = require('processor');

var EXAMPLE_UNSPENT_TX1 = {
        "txid" : "tx1",
        "vout" : 1,
        "scriptPubKey" : {
            "asm" : "OP_DUP OP_HASH160 3f712888fa9613f64cab02e2b4d6d756920d7186 OP_EQUALVERIFY OP_CHECKSIG",
            "hex" : "76a9143f712888fa9613f64cab02e2b4d6d756920d718688ac",
            "reqSigs" : 1,
            "type" : "pubkeyhash",
            "addresses" : [
                "pub1"
            ]
        },
        "amount" : 150000.00000000,
        "confirmations" : 8
    };

var EXAMPLE_UNSPENT_TX2 = {
        "txid" : "tx2",
        "vout" : 0,
        "scriptPubKey" : {
            "asm" : "OP_DUP OP_HASH160 daaf4b049a92c4e02acf1d8901b145519e4c55af OP_EQUALVERIFY OP_CHECKSIG",
            "hex" : "76a914daaf4b049a92c4e02acf1d8901b145519e4c55af88ac",
            "reqSigs" : 1,
            "type" : "pubkeyhash",
            "addresses" : [
                "pub2"
            ]
        },
        "amount" : 200.00000000,
        "confirmations" : 1
    };


describe('Processor', function() {
  describe('#processUnspent()', function() {
    it('should create transactions for those not already in the database', function(done) {
      // given
      var model = {
            getUnspentChainTransactions: sinon.stub().yields(null, [
                                              EXAMPLE_UNSPENT_TX1,
                                              EXAMPLE_UNSPENT_TX2
                                           ]),
            getTransactions: sinon.stub().withArgs(['tx1', 'tx2']).yields(null, [
                                            { public_address: 'pub1', txid: 'tx1', vout: 0},
                                            { public_address: 'pub2', txid: 'tx2', vout: 0}]),
            addTransaction: mock = sinon.mock().withArgs('pub1', 'tx1', 1, 8, 150000).yields()
          }
        , sut = new Processor(model)
        , spy = sinon.spy(then);

      // when
      sut.processUnspent(spy);

      // then
      function then() {
        mock.verify();
        done();
      }
    });
  });

  describe('#processUnconfirmed()', function() {
    it('should process the unconfirmed transactions with confirmations greater than 2', function(done) {
      // given
      var model = {
            getTransactionsInState: sinon.stub().withArgs('unconfirmed').yields(null, [
                                        {public_address: 'pub1', txid: 'tx1', vout: 1},
                                        {public_address: 'pub2', txid: 'tx2', vout: 0}
                                      ]),
            confirmTransaction: mock = sinon.mock().withArgs('pub1', 'tx1', 1, 8).yields()
          }
        , sut = new Processor(model)
        , spy = sinon.spy(then);
      sut.confirmTransaction = sinon.mock().withArgs('tx1').yields();

      // when
      sut.processUnconfirmed([EXAMPLE_UNSPENT_TX1, EXAMPLE_UNSPENT_TX2], spy);

      // then
      function then() {
        mock.verify();
        done();
      }

    });
  });
});
