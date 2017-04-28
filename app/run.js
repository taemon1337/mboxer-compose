var minio = require('minio')
  , textract = require('textract')
  , MINIO = process.env.MINIO || 'minio'
  , BUCKET = process.env.BUCKET || 'evidence-vault'
  , PREFIX = process.env.PREFIX || 'DFS'
  , SUFFIX = process.env.SUFFIX || '.mbox'
  ;

var listener = minio.listenBucketNotification(BUCKET, PREFIX, SUFFIX, ['s3:ObjectCreated:*'])

listener.on('notification', function(record) {
  console.log('%s event occurred (%s)', record.eventName, record.eventTime)
})

