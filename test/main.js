var test = require('tape');
var deploy = require('../server/lib/deploy');

test('test_file_deploy', function(t) {
  var de = deploy.create('file', {});
  de._download('0.0.0', function(err) {
    t.error(err);
    t.end();
  });
});
