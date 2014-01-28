var assert = require('assert')
  , sinon = require('sinon');

var Processor = require('processor');

describe('Processor', function() {
  describe('#createTransaction', function() {
    it('should fail if fetching the chain transaction fails', function() {
      // given
      var model = {
            getChainTransaction: sinon.stub().yields(new Error('failed'))
          }
        , sut = new Processor(model)
        , spy = sinon.spy();
      // when
      sut.createTransaction('tx1', spy);
      // then
      spy.calledWith(sinon.match.instanceOf(Error));
    });

    it('should fail if adding the transaction fails', function() {
      // given
      var model = {
            getChainTransaction: sinon.stub().yields(null, {}),
            addTransaction: sinon.stub().yields(new Error('failed'))
          }
        , sut = new Processor(model)
        , spy = sinon.spy();
      // when
      sut.createTransaction('tx1', spy);
      // then
      spy.calledWith(sinon.match.instanceOf(Error));
    });

    it('should add a transaction with the details returned from the chain transaction', function(done) {
      // given
      var model = {
            getChainTransaction: sinon.stub().yields(null, {
              public_address: 'pubaddress',
              confirmations: 5,
              amount: 20.0
            }),
            addTransaction: mock = sinon.mock().withArgs('pubaddress', 'tx1', 5, 20.0).yields(null)
          }
        , sut = new Processor(model)
        , spy = sinon.spy(then);

      // when
      sut.createTransaction('tx1', spy);

      // then
      function then() {
        mock.verify();
        done();
      }
    });
  });

  describe('#processUnspent()', function() {
    it('should create transactions for those not already in the database', function(done) {
      // given
      var model = {
            getUnspentChainTransactions: sinon.stub().yields(null, [
                                            { txid: 'tx1', amount: 20.0, confirmations: 2},
                                            { txid: 'tx2', amount: 20.0, confirmations: 2},
                                            { txid: 'tx3', amount: 20.0, confirmations: 2},
                                            { txid: 'tx4', amount: 20.0, confirmations: 2}]),
            getTransactions: sinon.stub().withArgs(['tx1', 'tx2', 'tx3', 'tx4']).yields(null, [
                                            { public_address: 'pub1', txid: 'tx1'},
                                            { public_address: 'pub2', txid: 'tx2'}])
          }
        , sut = new Processor(model)
        , spy = sinon.spy(then);
      sut.createTransactions = sinon.mock().withArgs(['tx3', 'tx4']).yields();

      // when
      sut.processUnspent(spy);

      // then
      function then() {
        mock.verify();
        done();
      }

    });
  });
});
