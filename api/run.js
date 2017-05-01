var express = require('express')
  , app = express()
  , Store = require('./store')
  , PORT = parseInt(process.env.PORT || '8080')
;

var store = new Store();

app.get('/emails', function (req, res) {
  store.findAll('emails', {}).then(function (resp) {
    res.send(resp);
  }).catch(function (err) {
    res.status(500).send(err);
  });
});

app.listen(PORT);
