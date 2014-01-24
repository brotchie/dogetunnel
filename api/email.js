var EmailSender = function(mailgun) {
  this.mailgun = mailgun;
};

EmailSender.prototype.send_welcome_email = function(public_address, email, callback) {
  console.log('Sending email for ' + public_address + ' to ' + email);
  callback();
};

EmailSender.prototype.send_password_reset_email = function(public_address, email, nonce, callback) {
  console.log('Sending password reset email for ' + public_address + ' to ' + email + ' with nonce ' + nonce);
  callback();
};

exports.EmailSender = EmailSender;
