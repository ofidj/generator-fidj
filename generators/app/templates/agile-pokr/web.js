var express = require('express');
var gulp = require('gulp');
var replace = require('gulp-replace');

var app = express();
var port = Number(process.env.PORT || 8080);
var appId = process.env.FIDJ_APP_ID || 'demo';
var fidjProd = process.env.FIDJ_APP_PROD || 'true';

gulp
    .src(['www/build/main.js'])
    .pipe(replace(/fidjService.init.*/g, "fidjService.init('" + appId + "', { prod: " + fidjProd + " })"))
    .pipe(gulp.dest('www/build/'))
    .on('end', function () {

        app.use(express.static(__dirname + '/www'));
        var server = app.listen(port, function () {
            console.log('Listening on port %d', server.address().port);
        });

    });
