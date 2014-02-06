#!/usr/local/bin/node

/* Includes */
var fs = require('fs')
  , nunjucks = require('nunjucks');

/* Template configuration */
var config = require(__dirname + '/config.json');

/* Render all available views */
fs.readdir(config.views_directory, function(err, files) {
  files.forEach(function(file) {
    if (file.charAt(0) != ".") {
      console.log("Processing " + file);
      nunjucks.configure({ autoescape: false });
      var html = nunjucks.render(config.views_directory + file, config);
      fs.writeFile(config.public_directory + file, html);
    }
  });
});

