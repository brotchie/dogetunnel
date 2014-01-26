var async = require('async');

module.exports = function(app, model, email_sender) {

  app.post('/account', function(req, res) {
    var password = req.body.password;

    if (!password) {
      return res.status(500).end();
    }

    model.create_account(password, '192.168.0.1', function(err, public_address) {
      if (err) {
        console.log('Error', err);
        res.json({result: false});
      } else {
        res.json({result: true, public_address: public_address});
      }
    });

  });

  app.put('/account/:public_address/email', function(req, res) {
    var public_address = req.params.public_address
      , password = req.body.password
      , email = req.body.email;

    console.log(req.body);

    if (!password || !email) {
      return res.status(403).end();
    }

    async.series([
      function(next) {
        model.set_account_email(public_address, password, email, next);
      },
      function(next) {
        email_sender.send_welcome_email(public_address, email, next);
      }
    ], function(err) {
      res.json({result: !err});
    });
  });

  app.get('/account/:public_address/balance', function(req, res) {
    var public_address = req.params.public_address
      , password = req.query.password;

    if (!password) {
      return res.status(403).end();
    }

    model.get_account_balance(public_address, password, function(err, balance) {
      if (err) {
        res.json({result: false});
      } else {
        res.json({result: true, balance: balance});
      }
    });
  });

  app.post('/account/:public_address/password/request_reset', function(req, res) {
    var public_address = req.params.public_address;
    model.request_password_reset(public_address, function(err) {
      res.json({result: !err});
    });
  });

  app.post('/account/:public_address/password/reset', function(req, res) {
    var public_address = req.params.public_address
      , new_password = req.body.new_password
      , nonce = req.body.nonce;

    if (!new_password || !nonce) {
      return res.status(500).end();
    }

    model.reset_password(public_address, new_password, nonce, function(err) {
      if (err) {
        res.json({result: false, error: err.message});
      } else {
        res.json({result: true});
      }
    });
  });
};
