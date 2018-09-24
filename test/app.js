'use strict';
var path = require('path');
var assert = require('yeoman-assert');
var helpers = require('yeoman-test');

xdescribe('generator-fidj:app', function () {
  before(function () {
    return helpers.run(path.join(__dirname, '../generators/app'))
      .withPrompts({someAnswer: true})
      .toPromise();
  });

  xit('creates files', function () {
    assert.file([
      'package.json'
    ]);
  });
  it('todo', function () {
    assert(true);
  });
});
