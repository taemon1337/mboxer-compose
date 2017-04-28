var fs = require('fs')
  , Mbox = require('node-mbox')
  , Mailparser = require('mailparser')
  , winston = require('winston')
  , path = require('path')
  , Minio = require('minio')
  , SOURCE_BUCKET = process.env.SOURCE_BUCKET || 'working'
  , SOURCE_REGION = process.env.SOURCE_REGION || 'us-east-1'
  , SOURCE_PREFIX = process.env.SOURCE_PREFIX || ''
  , SOURCE_SUFFIX = process.env.SOURCE_SUFFIX || '.mbox'
  , MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio'
  , MINIO_BUCKET = process.env.MINIO_BUCKET || 'mbox'
  , MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000')
  , MINIO_REGION = process.env.MINIO_REGION || 'us-east-1'
  , MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minio-access-key'
  , MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minio-SECRET-key'
  , MINIO_PROTOCOL = process.env.MINIO_PROTOCOL || 'S3v4'
  , MINIO_SECURE = process.env.MINIO_SECURE || false
  , MINIO_CREATE = process.env.MINIO_CREATE || ['s3:ObjectCreated:*']
  , MINIO_REMOVE = process.env.MINIO_REMOVE || ['s3:ObjectRemoved:*']
;

winston.level = process.env.LOG_LEVEL || 'debug'

var minio = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  secure: MINIO_SECURE,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
})

// anytime we use the record.s3.object.key form, we'll need to decode it
function decodeUri(str) {
  return decodeURIComponent(str.replace(/\+/g,'%20'))
}

function makeBucket(mc, bucket, region, cb) {
  try {
    mc.bucketExists(bucket, function(err) {
      if(err && err.code == "NoSuchBucket") {
        mc.makeBucket(bucket, region, function(err) {
          if(err) {
            console.warn("Error creating bucket " + bucket, err);
          } else {
            cb()
          }
        })
      } else {
        cb()
      }
    });
  } catch(err) {
    console.log("Error making bucket " + bucket, err);
    cb()
  }
}

function parse (name) {
  minio.getObject(SOURCE_BUCKET, name, function (err, datastream) {
    if (err) throw err;

    var mbox = new Mbox(datastream, {})

    mbox.on('message', function (msg) {
      console.log('MESSAGE: ', msg);
    });

    mbox.on('error', function (err) {
      winston.error('Error parsing mbox', err);
    });

    mbox.on('end', function () {
      winston.info('MBOX COMPLETE');
    });
  });
}

function start() {
  winston.info("starting mbox processor...");

  var listener = minio.listenBucketNotification(SOURCE_BUCKET, SOURCE_PREFIX, SOURCE_SUFFIX, MINIO_CREATE)

  listener.on('notification', function (record) {
    winston.info('MBOX: ', record)
    var name = decodeUri(record.s3.object.key);
    parse(name);
  });

  process.on("SIGINT", function() {
    winston.info("stopping mbox processor...");
    listener.stop();
    process.exit();
  })
}

setTimeout(function() {
  makeBucket(minio, SOURCE_BUCKET, SOURCE_REGION, function () {
    makeBucket(minio, MINIO_BUCKET, MINIO_REGION, function () {
      start();
    });
  });
}, 6000);

