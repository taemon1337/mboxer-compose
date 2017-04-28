var fs = require('fs')
  , Mbox = require('node-mbox')
  , simpleParser = require('mailparser').simpleParser
  , winston = require('winston')
  , path = require('path')
  , crypto = require('crypto')
  , Store = require('./store')
  , store = null
  , Minio = require('minio')
  , INBOX_BUCKET = process.env.INBOX_BUCKET || 'inbox-data'
  , INBOX_REGION = process.env.INBOX_REGION || 'us-east-1'
  , INBOX_PREFIX = process.env.INBOX_PREFIX || ''
  , INBOX_SUFFIX = process.env.INBOX_SUFFIX || '.mbox'
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

function parse (bucket, name) {
  try {
    minio.getObject(bucket, name, function (err, datastream) {
      if (err) throw err;

      var mbox = new Mbox(datastream, {})

      mbox.on('message', function (msg) {
        var hash = crypto.createHash('sha256');
        hash.update(msg);
        simpleParser(msg).then(function (mail) {
          mail._bucket = bucket;
          mail._source = name;
          mail._sha256 = hash.digest('hex');
          saveMail(mail)
          //saveToMinio(name + "/" + mail._sha256 + '.json', mail)
        }).catch(function (err) {
          winston.warn('Error parsing message', err);
        });
      });

      mbox.on('error', function (err) {
        winston.error('Error parsing mbox', err);
      });

      mbox.on('end', function () {
        winston.info('MBOX COMPLETE');
      });
    });
  } catch(err) {
    winston.warn('EXCEPTION CAUGHT: ', err);
  }
}

function saveToMinio(name, mail) {
  minio.putObject(MINIO_BUCKET, name, JSON.stringify(mail,null,2), function (err, etag) {
    if (err) throw err;
    winston.info('Upload Success', name);
  });
}

function saveMail(mail) {
  store.create('email', mail).then(function (email) {
    winston.info('CREATED: ', email);
  }).catch(function (err) {
    winston.error('Error creating email', err);
  });
}

function start() {
  winston.info("starting mbox processor...");

  var inbox_notify = minio.listenBucketNotification(INBOX_BUCKET, INBOX_PREFIX, INBOX_SUFFIX, MINIO_CREATE)
  var source_notify = minio.listenBucketNotification(SOURCE_BUCKET, SOURCE_PREFIX, SOURCE_SUFFIX, MINIO_CREATE)

  inbox_notify.on('notification', function (record) {
    parse(INBOX_BUCKET, decodeUri(record.s3.object.key));
  });

  source_notify.on('notification', function (record) {
    parse(SOURCE_BUCKET, decodeUri(record.s3.object.key));
  });

  process.on("SIGINT", function() {
    winston.info("stopping mbox processor...");
    inbox_notify.stop();
    source_notify.stop();
    process.exit();
  })
}

setTimeout(function() {
  makeBucket(minio, INBOX_BUCKET, INBOX_REGION, function () {
    makeBucket(minio, SOURCE_BUCKET, SOURCE_REGION, function () {
      makeBucket(minio, MINIO_BUCKET, MINIO_REGION, function () {
        store = new Store();
        start();
      });
    });
  });
}, 6000);

