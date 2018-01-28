var _ = require('lodash');
var stats = require('../lib/stats');
var redisHost = require("../settings/").redisHost;
var redis = require("redis");
var redisClient = redis.createClient({ host: redisHost });
var prefix = "audiogram:";

redisClient.on("error", function(err) {
	console.log('REDIS ERROR>> ', err);
});

var cursor = "0";
var activeHeartbeats = [];
function scanHeartbeats() {
  redisClient.scan(cursor, "MATCH", "audiogram:heartbeat:*", function(err, res) {
    if (err) throw err;
    cursor = res[0];
    var keys = res[1];
    if (keys.length > 0) {
      activeHeartbeats = activeHeartbeats.concat(keys);
    }
    if (cursor === "0") {
      var count = _.uniq(activeHeartbeats).length;
      stats.gauge("users.loggedin", count);
      activeHeartbeats = [];
      setTimeout(function() {
        scanHeartbeats();
      }, 10000);
      return false;
    }
    return scanHeartbeats();
  });
}
scanHeartbeats();


function getUser(req) {
  if (req.header("host").startsWith("localhost")) {
    var name = "Localhost";
    var email = "localhost@audiogram.newslabs.co";
  } else {
    var name = req.header("BBC_IDOK") ? req.header("BBC_FULLNAME") : null;
    var email = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : null;
  }
  return {name, email};
}

function heartbeat(req, res) {
  var { name, email } = getUser(req);
  redisClient.set(`audiogram:heartbeat:${email}`, 1, "EX", 180);
  return res.json({ email });
}


function logout(req, res) {
  var { name, email } = getUser(req);
  redisClient.del(`audiogram:heartbeat:${email}`);
  return res.json({ email });
}

function whoami(req, res) {
  var {name, email} = getUser(req);
  redisClient.smembers(`audiogram:user:${email}`, (err, loginDates) => {
    var lastLogin = loginDates.sort()[loginDates.length - 1];
    redisClient.sadd(`audiogram:users`, email);
    redisClient.sadd(`audiogram:user:${email}`, Date.now());
    stats.increment("login");
    redisClient.scard("audiogram:users", function(err, count) {
      stats.gauge("users.registered", count);
    });
    return res.json({ name, email, lastLogin });
  });
}
	
module.exports = {
  heartbeat,
  logout,
	whoami
}