var buster = require('buster-node'),
  cron = require('cron'),
  dgram = require('dgram'),
  fs = require('fs'),
  Jenkins = require('../lib/jenkins'),
  referee = require('referee'),
  text = require('bagoftext'),
  assert = referee.assert,
  refute = referee.refute;


text.setLocale('en');

buster.testCase('jenkins - jenkins', {
  setUp: function () {
    this.stub(process, 'env', {});
    this.mockFs  = this.mock(fs);
    this.jenkins = new Jenkins();
  },
  'should use custom url when specified': function () {
    var jenkins = new Jenkins('http://jenkins-ci.org:8080');
    assert.equals(jenkins.url, 'http://jenkins-ci.org:8080');
  },
  'should use default url when url is not specified': function () {
    assert.equals(this.jenkins.url, 'http://localhost:8080');
  },
  'should handle authentication failure error': function (done) {
    this.jenkins.opts.handlers[401](null, function (err) {
      assert.equals(err.message, 'Authentication failed - incorrect username and/or password');
      done();
    });
  },
  'should handle authentication required error': function (done) {
    this.jenkins.opts.handlers[403](null, function (err) {
      assert.equals(err.message, 'Jenkins requires authentication - please set username and password');
      done();
    });
  },
  'should set cert': function (done) {
    this.mockFs.expects('statSync').once().withExactArgs('certificate.pem').returns(true);
    this.mockFs.expects('statSync').once().withExactArgs('custom.ca.pem').returns(true);
    this.mockFs.expects('statSync').once().withExactArgs('key.pem').returns(true);
    this.mockFs.expects('readFileSync').once().withExactArgs('certificate.pem').returns('somecert');
    this.mockFs.expects('readFileSync').once().withExactArgs('custom.ca.pem').returns('someca');
    this.mockFs.expects('readFileSync').once().withExactArgs('key.pem').returns('somekey');
    this.stub(process, 'env', {
      JENKINS_CERT: 'certificate.pem',
      JENKINS_CA: 'custom.ca.pem',
      JENKINS_KEY: 'key.pem:somepassphrase'
    });
    this.jenkins = new Jenkins();
    assert.equals(this.jenkins.opts.agentOptions.passphrase, 'somepassphrase');
    assert.equals(this.jenkins.opts.agentOptions.secureProtocol, 'TLSv1_method');
    assert.equals(this.jenkins.opts.agentOptions.cert, 'somecert');
    assert.equals(this.jenkins.opts.agentOptions.key, 'somekey');
    assert.equals(this.jenkins.opts.agentOptions.ca, 'someca');
    done();
  },
  'should not set agent options when cert files do not exist': function (done) {
    this.mockFs.expects('statSync').once().withExactArgs('certificate.pem').returns(false);
    this.mockFs.expects('statSync').once().withExactArgs('custom.ca.pem').returns(false);
    this.mockFs.expects('statSync').once().withExactArgs('key.pem').returns(false);
    this.stub(process, 'env', {
      JENKINS_CERT: 'certificate.pem',
      JENKINS_CA: 'custom.ca.pem',
      JENKINS_KEY: 'key.pem:somepassphrase'
    });
    this.jenkins = new Jenkins();
    assert.equals(this.jenkins.opts.agentOptions.passphrase, 'somepassphrase');
    assert.equals(this.jenkins.opts.agentOptions.secureProtocol, 'TLSv1_method');
    assert.equals(this.jenkins.opts.agentOptions.cert, undefined);
    assert.equals(this.jenkins.opts.agentOptions.key, undefined);
    assert.equals(this.jenkins.opts.agentOptions.ca, undefined);
    done();
  }
});

buster.testCase('jenkins - csrf', {
  setUp: function () {
    this.mock({});
  },
  'should add crumb header': function (done) {
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'crumb', function (cb) {
      var result = {
        '_class': 'hudson.security.csrf.DefaultCrumbIssuer',
        crumb: '7b12516ae03ff48a099aa2f32906dafa',
        crumbRequestField: 'Jenkins-Crumb'
      };
      cb(null, result);
    });
    jenkins.csrf(function (err, result) {
      assert.equals(jenkins.opts.headers['Jenkins-Crumb'], '7b12516ae03ff48a099aa2f32906dafa');
      done();
    });
  },
  'should pass error to callback': function (done) {
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'crumb', function (cb) {
      cb(new Error('some error'));
    });
    jenkins.csrf(function (err, result) {
      assert.equals(err.message, 'some error');
      done();
    });
  }
});

buster.testCase('jenkins - monitor', {
  setUp: function () {
    this.mock({});
  },
  'should monitor all jobs on Jenkins instance when no job or view opt specified': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
      done();
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'info', function (cb) {
      var result = { jobs: [
        { color: 'blue' },
        { color: 'red' },
        { color: 'yellow' },
        { color: 'notbuilt' }
      ]};
      cb(null, result);
    });
    jenkins.monitor({ schedule: '*/30 * * * * *' }, function (err, result) {
      assert.isNull(err);
      assert.equals(result, 'fail');
    });
  },
  'should result in status non-success when a job has non-success color but no red and yellow': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
      done();
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'info', function (cb) {
      var result = { jobs: [
        { color: 'blue' },
        { color: 'notbuilt' },
        { color: 'blue' }
      ]};
      cb(null, result);
    });
    jenkins.monitor({ schedule: '*/30 * * * * *' }, function (err, result) {
      assert.isNull(err);
      assert.equals(result, 'notbuilt');
    });
  },
  'should result in status success when a job has all blue or green color': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
      done();
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'info', function (cb) {
      var result = { jobs: [
        { color: 'blue' },
        { color: 'green' },
        { color: 'blue' }
      ]};
      cb(null, result);
    });
    jenkins.monitor({ schedule: '*/30 * * * * *' }, function (err, result) {
      assert.isNull(err);
      assert.equals(result, 'ok');
    });
  },
  'should result in status warn when view opt is specified and a job has yellow color but no red': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
      done();
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'readView', function (name, cb) {
      assert.equals(name, 'someview');
      var result = { jobs: [
        { color: 'blue' },
        { color: 'yellow' }
      ]};
      cb(null, result);
    });
    jenkins.monitor({ view: 'someview', schedule: '*/30 * * * * *' }, function (err, result) {
      assert.isNull(err);
      assert.equals(result, 'warn');
    });
  },
  'should pass error when an error occurs while monitoring a view': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'readView', function (name, cb) {
      assert.equals(name, 'someview');
      cb(new Error('some error'));
    });
    jenkins.monitor({ view: 'someview', schedule: '*/30 * * * * *' }, function (err, result) {
      assert.equals(err.message, 'some error');
      done();
    });
  },
  'should monitor the latest build of a job when job opt is specified': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
      done();
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'readJob', function (name, cb) {
      assert.equals(name, 'somejob');
      var result = { color: 'blue' };
      cb(null, result);
    });
    jenkins.monitor({ job: 'somejob', schedule: '*/30 * * * * *' }, function (err, result) {
      assert.isNull(err);
      assert.equals(result, 'ok');
    });
  },
  'should pass error when an error occurs while monitoring a job': function (done) {
    this.stub(cron.CronJob.prototype, 'start', function () {
    });
    var jenkins = new Jenkins('http://localhost:8080');
    this.stub(Jenkins.prototype, 'readJob', function (name, cb) {
      assert.equals(name, 'somejob');
      cb(new Error('some error'));
    });
    jenkins.monitor({ job: 'somejob' }, function (err, result) {
      assert.equals(err.message, 'some error');
      done();
    });
  }
});
