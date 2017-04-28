var express = require("express")
  , app = express()
  , winston = require('winston')
  , publicDir = process.env.PUBLIC_DIR || 'web'
  , Moment = require('moment')
  , Busboy = require('busboy')
  , Minio = require('minio')
  , Readable = require('stream').Readable
  , Crypto = require('crypto')
  , uuid = require('node-uuid')
  , allowed_orgs = process.env.ALLOWED_ORGS ? process.env.ALLOWED_ORGS.split(',') : ['DFS','FSL']
  , disable_orgs = process.env.DISABLE_ORGS || false
  , bucket = process.env.MINIO_BUCKET || 'inbox-data'
  , region = process.env.MINIO_REGION || 'us-east-1'
  , port = process.env.SERVER_PORT || 8080
;

winston.level = process.env.LOG_LEVEL || 'debug'

var mc = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: process.env.MINIO_PORT || 9000,
  secure: process.env.MINIO_SECURE || false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio-access-key',
  secretKey: process.env.MINIO_SECRET_KEY || 'minio-SECRET-key'
})

setTimeout(function() {
  mc.bucketExists(bucket, function(err) {
    if(err) {
      mc.makeBucket(bucket, region, function(err) {
        if(err) { winston.warn("Error making bucket "); }
      });
    }
  });
}, 5000);


app.use(express.static(publicDir));

app.post('/uploads', function(req, res) {
  var _error = false;
  var busboy = new Busboy({ headers: req.headers });
  var date = Moment().format('YYYY-MM-DD');
  var uid = Moment().format('h:mm:ss-') + uuid.v4().toString();
  var formdata = { path: date+"/"+uid, children: [] };

  busboy.on('error', function(err) {
    winston.warn('Parsing Error: ', err)
    res.status(500).write(err);
    _error = true;
  });

  busboy.on('field', function(fieldname, val, fieldnameTrunc, valTrunc, encoding, mimetype) {
    formdata[fieldname] = val;
    if(fieldname === "org") {
      if(allowed_orgs.indexOf(val) !== -1) {
        if(!disable_orgs) {
          formdata.path = val+"/"+formdata.path
        }
      } else {
        res.status(500).write("Invalid Request Parameter");
        _error = true
      }
    }
  });

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    var info = {
      path: formdata.path+"/"+filename,
      filename: filename,
      encoding: encoding,
      mimetype: mimetype,
      timestamp: Moment().format('YYYY-MM-DD-hh:mm:ss')
    }
    var md5 = Crypto.createHash('md5');
    var sha1 = Crypto.createHash('sha1');
    var sha256 = Crypto.createHash('sha256');
    var size = 0;

    file.on('data', function(chunk) {
      md5.update(chunk);
      sha1.update(chunk);
      sha256.update(chunk);
      size += chunk.length;
    });

    file.on('end', function() {
      info.md5    = md5.digest('hex'),
      info.sha1   = sha1.digest('hex'),
      info.sha256 = sha256.digest('hex')
      info.size = size;

      formdata.children.push(info);
    });

    if(!_error) {
      mc.putObject(bucket, info.path, file, mimetype || 'application/octect-stream', function(err) {
        if(err) {
          winston.warn("Error saving file! " + info.path, err);
          res.status(500).write(err);
          _error = true;
        } else {
          winston.info("Saved " + info.path);
        }
      });
    }
  });

  busboy.on('finish', function() {
    var uidj = formdata.path+".json";
    if(!_error) {
      mc.putObject(bucket, uidj, Buffer.from(JSON.stringify(formdata,null,2),'utf8'), "application/json", function(err) {
        if(err) {
          winston.warn("Error saving info file " + uidj, err);
          res.status(500).send(err);
        } else {
          winston.info("Saved " + uidj);
          res.send(JSON.stringify(formdata,null,2));
        }
      });
    } else {
      res.end();
    }
  });

  req.pipe(busboy);
});

app.listen(port);
