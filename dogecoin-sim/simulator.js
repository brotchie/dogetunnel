var fs = require('fs')
  , assert = require('assert');

var jayson = require('jayson')
  , _ = require('lodash');

var Simulator = function() {
  var script;// = JSON.parse(fs.readFileSync(script_path));

  this.setScript = function(path) {
    script = JSON.parse(fs.readFileSync(path));
  };

  var self = this;

  function simulate(name) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var callback = args.pop();

      var expected = script.shift();

      if (name !== expected.method) {
        throw new Error('expected', expected.method, JSON.stringify(expected.params));
      }
      if (expected.params && !_.isEqual(args, expected.params)) {
        throw new Error('expected ' + JSON.stringify(expected.params));
      }


      callback(null, expected.result);

      if (script.length == 0) {
        setTimeout(function() {
          self.close();
        }, 0);
      }
    }
  }

  var server = jayson.server({
    getnewaddress: simulate('getnewaddress'),
    listunspent: simulate('listunspent'),
    gettransaction: simulate('gettransaction')
  }, {
    version: 1
  });

  this.listen = function(port, callback) {
    server.http().listen(port, callback);
  }


  this.close = function() {
    //server.http.close();
  }
};

module.exports = Simulator;
