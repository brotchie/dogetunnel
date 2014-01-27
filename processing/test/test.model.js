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
});

