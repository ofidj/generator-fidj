var path = require('path');
var gulp = require('gulp');
var eslint = require('gulp-eslint');
var excludeGitignore = require('gulp-exclude-gitignore');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var nsp = require('gulp-nsp');
var plumber = require('gulp-plumber');

gulp.task('static', function () {
  return gulp.src('**/*.js')
    .pipe(excludeGitignore())
    .pipe(eslint({
      options: {
        configFile: 'eslint.json',
        fix: true,
        rulesdir: ['eslint_rules']
      }
    }))
    .pipe(eslint.format())
    //.pipe(eslint.failAfterError())
    ;
});

const taskNsp = gulp.task('nsp', function (cb) {
  nsp({package: path.resolve('package.json')}, cb);
});

const taskPreTest = gulp.task('pre-test', function () {
  return gulp.src('generators/**/*.js')
    .pipe(excludeGitignore())
    .pipe(istanbul({
      includeUntested: true
    }))
    .pipe(istanbul.hookRequire());
});

gulp.task('test', gulp.series('pre-test', function (cb) {
  var mochaErr;

  gulp.src('test/**/*.js')
    .pipe(plumber())
    .pipe(mocha({reporter: 'spec'}))
    .on('error', function (err) {
      mochaErr = err;
    })
    .pipe(istanbul.writeReports())
    .on('end', function () {
      cb(mochaErr);
    });
}));

gulp.task('watch', function () {
  gulp.watch(['generators/**/*.js', 'test/**'], ['test']);
});

gulp.task('prepublish', gulp.series('nsp'));
//todo gulp.task('default', ['static', 'test']);
gulp.task('default', gulp.series('test'));
