var assert = require('assert')
  , sinon = require('sinon');

var Model = require('model');


EXAMPLE_UNSPENT_TX1 = {"txid":"49af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c","vout":0,"scriptPubKey":"76a914a70883b266b17b2a0c01b335befcd75b1be85ff288ac","amount":20.00000000,"confirmations":1};
EXAMPLE_UNSPENT_TX2 = {"txid":"59af0dba3d4e7d88c917493765ebf90355f7e092fe544ce489fbef709fa2a89c","vout":0,"scriptPubKey":"76a914a70883b266b17b2a0c01b335befcd75b1be85ff288ac","amount":40.00000000,"confirmations":4};

describe('Model', function() {
  describe('#getUnspentTransactions()', function() {
    it('should fetch unspent transaction from dogecoind', function() {
      // given
      var dogecoin = {
            listUnspent: mock = sinon.mock().yields()
          }
        , sut = new Model(null, dogecoin)
        , spy = sinon.spy();
      // when
      sut.getUnspentTransactions(spy);

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
      sut.getUnspentTransactions(spy);

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
      sut.getUnspentTransactions(spy);

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
      sut.getUnspentTransactions(spy);

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

});

