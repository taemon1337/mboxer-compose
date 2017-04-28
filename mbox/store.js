var JSData = require('js-data')
  , DSMongoDBAdapter = require('js-data-mongodb')

var Store = function() {
  this.store = new JSData.DS();
  this.adapter = new DSMongoDBAdapter({ uri: 'mongodb://mongo:27017', debug: true });
  this.store.registerAdapter('mongodb', this.adapter, { default: true });

  this.store.defineResource({
    name: 'emails',
    idAttribute: "_id",
  });
}

exports = module.exports = Store

