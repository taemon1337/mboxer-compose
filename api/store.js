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

Store.prototype = {
  create: function () {
    return this.store.create.apply(this.store, arguments);
  },
  find: function () {
    return this.store.find.apply(this.store, arguments);
  },
  findAll: function () {
    return this.store.findAll.apply(this.store, arguments);
  }
}

exports = module.exports = Store

