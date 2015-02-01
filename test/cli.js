var buster = require('buster-node'),
  _cli = require('bagofcli'),
  cli = require('../lib/cli'),
  Jenkins = new require('../lib/jenkins'),
  referee = require('referee'),
  text = require('bagoftext'),
  util = require('util'),
  assert = referee.assert;

text.setLocale('en');

buster.testCase('cli - exec', {
  'should contain commands with actions': function (done) {
    var mockCommand = function (base, actions) {
      assert.defined(base);
      assert.defined(actions.commands.build.action);
      assert.defined(actions.commands.console.action);
      assert.defined(actions.commands.stop.action);
      assert.defined(actions.commands.dashboard.action);
      assert.defined(actions.commands.discover.action);
      assert.defined(actions.commands.executor.action);
      assert.defined(actions.commands.job.action);
      assert.defined(actions.commands.last.action);
      assert.defined(actions.commands['create-job'].action);
      assert.defined(actions.commands['update-job'].action);
      assert.defined(actions.commands['delete-job'].action);
      assert.defined(actions.commands['enable-job'].action);
      assert.defined(actions.commands['disable-job'].action);
      assert.defined(actions.commands['copy-job'].action);
      assert.defined(actions.commands['fetch-job-config'].action);
      assert.defined(actions.commands.queue.action);
      assert.defined(actions.commands.ver.action);
      assert.defined(actions.commands.feed.action);
      done();
    };
    this.stub(_cli, 'command', mockCommand);
    cli.exec();
  }
});

// buster.testCase('cli - last', {
//     setUp: function () {
//         this.mockConsole = this.mock(console);
//         this.mockProcess = this.mock(process);
//         this.stub(_cli, 'command', function (base, actions) {
//             actions.commands.last.action('job1');
//         });
//     },
//     'should log job name, build status and build date when job exists': function () {
//         this.mockConsole.expects('log').once().withExactArgs('%s | %s', 'job1', 'SUCCESS'.green);
//         this.mockConsole.expects('log').once().withExactArgs(' - %s [%s]', 'My date', 'My distance');
//         this.mockProcess.expects('exit').once().withExactArgs(0);
//         this.stub(Jenkins.prototype, 'last', function (name, cb) {
//             assert.equals(name, 'job1');
//             cb(null, {
//                 buildDate: "My date",
//                 buildDateDistance: "My distance",
//                 building: false,
//                 result: "SUCCESS"
//             });
//         });
//         cli.exec();
//     },
//     'should log status as BUILDING if job is currently being built': function () {
//         this.mockConsole.expects('log').once().withExactArgs('%s | %s', 'job1', 'BUILDING'.yellow);
//         this.mockConsole.expects('log').atLeast(1);
//         this.mockProcess.expects('exit').once().withExactArgs(0);
//         this.stub(Jenkins.prototype, 'last', function (name, cb) {
//             assert.equals(name, 'job1');
//             cb(null, {
//                 buildDate: "My date",
//                 buildDateDistance: "My distance",
//                 building: true
//             });
//         });
//         cli.exec();
//     },
//     'should log not found error when build does not exist': function () {
//         this.mockConsole.expects('error').once().withExactArgs('someerror'.red);
//         this.mockProcess.expects('exit').once().withExactArgs(1);
//         this.stub(Jenkins.prototype, 'last', function (name, cb) {
//             assert.equals(name, 'job1');
//             cb(new Error('someerror'));
//         });
//         cli.exec();
//     }
// });