var assert = require('assert')
  , sinon = require('sinon');

var Model = require('model');


var EXAMPLE_UNSPENT_TX1 = {
        "txid" : "ce06b6330d9437f41ccfd0dc67ac65102831b3005c8b9088c389f4186d5bca4f",
        "vout" : 1,
        "scriptPubKey" : {
            "asm" : "OP_DUP OP_HASH160 3f712888fa9613f64cab02e2b4d6d756920d7186 OP_EQUALVERIFY OP_CHECKSIG",
            "hex" : "76a9143f712888fa9613f64cab02e2b4d6d756920d718688ac",
            "reqSigs" : 1,
            "type" : "pubkeyhash",
            "addresses" : [
                "nZycPjdZFQcujzsRDBDiRCXquizD9XUCqE"
            ]
        },
        "amount" : 150000.00000000,
        "confirmations" : 8
    };

var EXAMPLE_UNSPENT_TX2 = {
        "txid" : "e131d56416e0c295bacab895dfcbd3723f3c940204783417e33a3a1910231e76",
        "vout" : 0,
        "scriptPubKey" : {
            "asm" : "OP_DUP OP_HASH160 daaf4b049a92c4e02acf1d8901b145519e4c55af OP_EQUALVERIFY OP_CHECKSIG",
            "hex" : "76a914daaf4b049a92c4e02acf1d8901b145519e4c55af88ac",
            "reqSigs" : 1,
            "type" : "pubkeyhash",
            "addresses" : [
                "np8TZfUHPkWnNSa4qHXAf1DkbdfoF9vZJ9"
            ]
        },
        "amount" : 200.00000000,
        "confirmations" : 17
    };

EXAMPLE_GET_TRANSACTION = {"amount":20.00000000,"confirmations":1,"blockhash":"7a75970081b30d98aa170a14d85ff7fd655979e6e49732b6b9d1643c594f23cd","blockindex":4,"txid":"49af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c","time":1390205310,"details":[{"account":"DT1","address":"DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC","category":"receive","amount":20.00000000}]};

describe('Model', function() {
  describe('#getChainTransaction()', function() {
    it('should fetch given transaction from dogecoind', function() {
      // given
      var dogecoin = {
            getTransaction: mock = sinon.mock().yields(null, {details:[]})
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getChainTransaction('tx1', spy);

      // then
      mock.verify();
    });

    it('should return a mapping of addresses to amounts and confirmations', function() {
      // given
      var dogecoin = {
            getTransaction: sinon.stub().yields(null, EXAMPLE_GET_TRANSACTION)
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getChainTransaction('tx1', spy);

      // then
      assert(spy.calledWith(null, [{
          public_address: 'DL4TqXtbE3iAS49qQgkV2iWWuP6h4HyMTC',
          amount: 20,
          confirmations: 1
        }]));

    });
  });

  describe('#getTransactions', function() {
    it('should do nothing if no transactions are given', function() {
      // given
      var sut = new Model(null, null)
        , spy = sinon.spy();
      // when
      sut.getTransactions([], spy);
      // then
      assert(spy.calledWith(null, []));
    });

    it('should dispatch a query to the database if one or more transactions are given', function() {
      // given
      var client = {
        query: mock = sinon.mock().yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.getTransactions(['tx1'], spy);
      // then
      mock.verify();

    });

    it('should correct construct a database query to fetch all txids', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT public_address, txid, confirmations, amount, state FROM transaction WHERE txid IN ($1, $2);', ['tx1', 'tx2']).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.getTransactions(['tx1', 'tx2'], spy);
      // then
      mock.verify();
    });

    it('should returns the rows of the database query', function() {
      // given
      var client = {
          query: sinon.stub().yields(null, {rows: ['row1', 'row2']})
        }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.getTransactions(['tx1', 'tx2'], spy);
      // then
      assert(spy.calledWith(null, ['row1', 'row2']));
    });
  });

  describe('#getTransactionsInState', function() {
    it('should query the transaction table for all transactions in the given state', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT * FROM transaction WHERE state=$1;', ['credited']).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.getTransactionsInState(sut.CREDITED, spy);
      // then
      mock.verify();

    });
  });

  describe('#confirmTransaction', function() {
    it('should dispatch a query to the database to call transaction_confirm', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_confirm($1, $2, $3, $4);', ['pubaddress', 'tx1', 0, 4]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.confirmTransaction('pubaddress', 'tx1', 0, 4, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#creditTransaction', function() {
    it('should dispatch a query to the database to call transaction_credit', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_credit($1, $2, $3, $4);', ['pubaddress', 'tx1', 0, 4.5]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.creditTransaction('pubaddress', 'tx1', 0, 4.5, spy);
      // then
      mock.verify();
      assert(spy.called);

    });
  });

  describe('#spendTransaction', function() {
    it('should dispatch a query to the database to call transaction_spend', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_spend($1, $2, $3, $4);', ['pubaddress', 'tx1', 0, 'tx2']).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.spendTransaction('pubaddress', 'tx1', 0, 'tx2', spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#completeTransaction', function() {
    it('should dispatch a query to the database to call transaction_complete', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_complete($1, $2, $3, $4);', ['pubaddress', 'tx1', 0, 4]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.completeTransaction('pubaddress', 'tx1', 0, 4, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#addTransaction', function() {
    it('should insert a new row into the transaction table', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('INSERT INTO transaction (public_address, txid, vout, confirmations, amount) VALUES ($1, $2, $3, $4, $5);', ['pubaddress', 'tx1', 0, 4, 20.0]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.addTransaction('pubaddress', 'tx1', 0, 4, 20.0, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

});

