var fs = require('fs')
  , Promise = require('bluebird')
  , winston = require('winston')
  , yauzl = require('yauzl')
  , temp = require('temp')
  , path = require('path')
  , Minio = require('minio')
  , INBOX_BUCKET = process.env.INBOX_BUCKET || 'inbox-data'
  , INBOX_REGION = process.env.INBOX_REGION || 'us-east-1'
  , INBOX_PREFIX = process.env.INBOX_PREFIX || ''
  , INBOX_SUFFIX = process.env.INBOX_SUFFIX || '.zip'
  , SOURCE_BUCKET = process.env.SOURCE_BUCKET || 'working'
  , SOURCE_REGION = process.env.SOURCE_REGION || 'us-east-1'
  , SOURCE_PREFIX = process.env.SOURCE_PREFIX || ''
  , SOURCE_SUFFIX = process.env.SOURCE_SUFFIX || '.zip'
  , MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio'
  , MINIO_BUCKET = process.env.MINIO_BUCKET || 'working'
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

function mkdirp (dir, cb) {
  if (dir === '.') return cb();
  fs.stat(dir, function (err) {
    if (err == null) return cb(); //already exists
    var parent = path.dirname(dir);
    mkdirp(parent, function () {
      fs.mkdir(dir, cb);
    });
  });
}

function download (bucket, name) {
  return new Promise(function (resolve, reject) {
    minio.getObject(bucket, name, function (err, datastream) {
      if (err) {
        winston.warn('Error getting object ' + name, err)
        reject(err);
      } else {
        var filename = path.basename(name);

        temp.open(filename, function (err, info) {
          if (err) throw err;
          var writestream = fs.createWriteStream(info.path);

          writestream.on('error', function (err) {
            winston.error('Error writing stream', err);
            reject(err);
          });

          writestream.on('close', function () {
            resolve(info.path);
          });

          datastream.on('error', function (err) {
            winston.error('Error reading data stream', err);
            reject(err);
          });

          datastream.on('end', function () {
            winston.info('Data stream complete');
          });

          datastream.pipe(writestream);
        });
      }
    });
  });
}

function unzip (zipPath) {
  yauzl.open(zipPath, { lazyEntries: true }, function (err, zipfile) {
    if (err) throw err;

    zipfile.readEntry();

    zipfile.on('end', function () {
      winston.info('Zipfile complete!');
    });

    zipfile.on('entry', function (entry) {
      winston.info('Entry: ', entry.fileName);

      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry(); // entry is directory, so go to next
      } else {
        zipfile.openReadStream(entry, function (err, readstream) {
          if (err) throw err;

          readstream.on('end', function () {
            zipfile.readEntry();
          });

          minio.putObject(MINIO_BUCKET, entry.fileName, readstream, function (err, etag) {
            if (err) throw err;
            winston.info('Upload Success', entry.fileName);
          });
        });
      }
    });
  });
}

function start() {
  winston.info("starting unzipper processor...");

  var inbox_listener = minio.listenBucketNotification(INBOX_BUCKET, INBOX_PREFIX, INBOX_SUFFIX, MINIO_CREATE)
  var source_listener = minio.listenBucketNotification(SOURCE_BUCKET, SOURCE_PREFIX, SOURCE_SUFFIX, MINIO_CREATE)

  inbox_listener.on('notification', function (record) {
    winston.info('FOUND NEW ZIP FILE', record)
    var name = decodeUri(record.s3.object.key);

    download(INBOX_BUCKET, name).then(function (info) {
      console.log('DOWNLOAD INFO', info);
      unzip(info);
    }).catch(function (err) {
      winston.error('Error downloading ', err);
    });
  });

  source_listener.on('notification', function (record) {
    winston.info('FOUND NEW ZIP FILE', record)
    var name = decodeUri(record.s3.object.key);

    download(SOURCE_BUCKET, name).then(function (info) {
      console.log('DOWNLOAD INFO', info);
      unzip(info);
    }).catch(function (err) {
      winston.error('Error downloading ', err);
    });
  });

  process.on("SIGINT", function() {
    winston.info("stopping unzipper processor...");
    inbox_listener.stop();
    source_listener.stop();
    process.exit();
  })
}

setTimeout(function() {
  makeBucket(minio, INBOX_BUCKET, SOURCE_REGION, function () {
    makeBucket(minio, SOURCE_BUCKET, SOURCE_REGION, function () {
      makeBucket(minio, MINIO_BUCKET, MINIO_REGION, function () {
        start();
      });
    });
  });
}, 5000);

