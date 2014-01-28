var assert = require('assert')
  , sinon = require('sinon');

var Model = require('model');


EXAMPLE_UNSPENT_TX1 = {"txid":"49af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c","vout":0,"scriptPubKey":"76a914a70883b266b17b2a0c01b335befcd75b1be85ff288ac","amount":20.00000000,"confirmations":1};
EXAMPLE_UNSPENT_TX2 = {"txid":"59af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c","vout":0,"scriptPubKey":"76a914a70883b266b17b2a0c01b335befcd75b1be85ff288ac","amount":40.00000000,"confirmations":4};

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
  describe('#getUnspentChainTransactions()', function() {
    it('should fetch unspent transaction from dogecoind', function() {
      // given
      var dogecoin = {
            listUnspent: mock = sinon.mock().yields()
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getUnspentChainTransactions(spy);

      // then
      mock.verify();
    });
    it('should return no unspent transactions if dogecoind returns no unspent transactions', function() {
      // given
      var dogecoin = {
            listUnspent: sinon.stub().yields(null, [])
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getUnspentChainTransactions(spy);

      // then
      assert(spy.calledWith(null, []));

    });
    it('should return error if dogecoind throws an error', function() {
       // given
      var dogecoin = {
            listUnspent: sinon.stub().yields(new Error('failed'))
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getUnspentChainTransactions(spy);

      // then
      assert(spy.calledWith(sinon.match.instanceOf(Error)));
    });

    it('should extract and return each transactions amount, txid, and confirmation count', function() {
      // given
      var dogecoin = {
            listUnspent: sinon.stub().yields(null, [EXAMPLE_UNSPENT_TX1, EXAMPLE_UNSPENT_TX2])
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getUnspentChainTransactions(spy);

      // then
      assert(spy.calledWith(null, [
          {txid: '49af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c', confirmations: 1, amount: 20.0},
          {txid: '59af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c', confirmations: 4, amount: 40.0}
      ]));
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

  describe('#confirmTransaction', function() {
    it('should dispatch a query to the database to call transaction_confirm', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_confirm($1, $2, $3);', ['pubaddress', 'tx1', 4]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.confirmTransaction('pubaddress', 'tx1', 4, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#creditTransaction', function() {
    it('should dispatch a query to the database to call transaction_credit', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_credit($1, $2, $3);', ['pubaddress', 'tx1', 4.5]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.creditTransaction('pubaddress', 'tx1', 4.5, spy);
      // then
      mock.verify();
      assert(spy.called);

    });
  });

  describe('#spendTransaction', function() {
    it('should dispatch a query to the database to call transaction_spend', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_spend($1, $2, $3);', ['pubaddress', 'tx1', 'tx2']).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.spendTransaction('pubaddress', 'tx1', 'tx2', spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#completeTransaction', function() {
    it('should dispatch a query to the database to call transaction_complete', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('SELECT transaction_complete($1, $2, $3);', ['pubaddress', 'tx1', 4]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.completeTransaction('pubaddress', 'tx1', 4, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

  describe('#addTransaction', function() {
    it('should insert a new row into the transaction table', function() {
      // given
      var client = {
            query: mock = sinon.mock().withArgs('INSERT INTO transaction (public_address, txid, confirmations, amount) VALUES ($1, $2, $3, $4);', ['pubaddress', 'tx1', 4, 20.0]).yields(null, { row: [] })
          }
        , sut = new Model(client, null)
        , spy = sinon.spy();
      // when
      sut.addTransaction('pubaddress', 'tx1', 4, 20.0, spy);
      // then
      mock.verify();
      assert(spy.called);
    });
  });

});

