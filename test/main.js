var scsslint = require('../src');

var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var should = require('should');
require('mocha');

var getFile = function(filePath) {
   filePath = 'test/' + filePath;
   return new gutil.File({
      path: filePath,
      cwd: 'test/',
      base: path.dirname(filePath),
      contents: fs.readFileSync(filePath)
   });
};

describe('gulp-scsslint', function() {
   describe('scsslint()', function() {

      it('should pass file through', function(done) {
         var fileCount = 0;

         var file = getFile('fixtures/pass.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
            should.exist(newFile);
            should.exist(newFile.path);
            should.exist(newFile.relative);
            should.exist(newFile.contents);
            newFile.path.should.equal('test/fixtures/pass.scss');
            newFile.relative.should.equal('pass.scss');
            ++fileCount;
         });

         stream.once('end', function() {
            fileCount.should.equal(1);
            done();
         });

         stream.write(file);
         stream.end();
      });

      it('should send success status', function(done) {
         var file = getFile('fixtures/pass.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
            should.exist(newFile.scsslint.success);
            newFile.scsslint.success.should.equal(true);
            should.not.exist(newFile.scsslint.results);
         });
         stream.once('end', function() {
           done();
         });

         stream.write(file);
         stream.end();
      });

      it('should send failure status', function(done) {
         var file = getFile('fixtures/warning.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
            should.exist(newFile.scsslint.success);
            newFile.scsslint.success.should.equal(false);
            should.exist(newFile.scsslint.results);
         });
         stream.once('end', function() {
            done();
         });

         stream.write(file);
         stream.end();
      });

      it('should lint two files', function(done) {
         var fileCount = 0;

         var file1 = getFile('fixtures/error.scss');
         var file2 = getFile('fixtures/warning.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
           ++fileCount;
         });

         stream.once('end', function() {
            fileCount.should.equal(2);
            done();
         });

         stream.write(file1);
         stream.write(file2);
         stream.end();
      });

      it('should support config file as options param', function(done) {
         var file = getFile('fixtures/pass-with-config.scss');

         var stream = scsslint('test/fixtures/scss-lint-config.yml');
         stream.on('data', function(newFile) {
           should.exist(newFile.scsslint.success);
           newFile.scsslint.success.should.equal(true);
           should.not.exist(newFile.scsslint.results);
           should.not.exist(newFile.scsslint.opt);
         });

         stream.once('end', function() {
           done();
         });

         stream.write(file);
         stream.end();
      });

      it('should support config file in options param', function(done) {
         var file = getFile('fixtures/pass-with-config.scss');

         var stream = scsslint({ config: 'test/fixtures/scss-lint-config.yml' });
         stream.on('data', function(newFile) {
           should.exist(newFile.scsslint.success);
           newFile.scsslint.success.should.equal(true);
           should.not.exist(newFile.scsslint.results);
           should.not.exist(newFile.scsslint.opt);
         });

         stream.once('end', function() {
           done();
         });

         stream.write(file);
         stream.end();
      });

      it('should included detailed issues on error', function(done) {
         var file = getFile('fixtures/warning.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
            should.exist(newFile.scsslint.results[0].reason);
            should.exist(newFile.scsslint.results[0].line);
            should.exist(newFile.scsslint.results[0].severity);
         });
         stream.once('end', function() {
            done();
         });

         stream.write(file);
         stream.end();
      });

      it('should emit an error if scss-lint is not available', function(done) {
         var fileCount = 0;

         var file = getFile('fixtures/pass.scss');

         var stream = scsslint({ bin: 'scss-lint-not-installed' });

         stream.once('end', function() {
            // fileCount.should.equal(1);
         });

         stream.on('error', function(error) {
            error.message.should.match(/could not be found/);
            done();
        });

         stream.write(file);
         stream.end();
      });

      it('should be runnable through bundle exec', function(done) {
         var fileCount = 0;

         var file = getFile('fixtures/pass.scss');

         var stream = scsslint({ bin: 'bundle exec scss-lint' });
         stream.on('data', function(newFile) {
            newFile.scsslint.success.should.equal(true);
            ++fileCount;
         });
         stream.once('end', function() {
            fileCount.should.equal(1);
            done();
         });

         stream.write(file);
         stream.end();
      });

      it('should handle scss file paths with spaces', function(done) {
         var fileCount = 0;

         var file = getFile('fixtures/pass with spaces.scss');

         var stream = scsslint();
         stream.on('data', function(newFile) {
            should.exist(newFile);
            newFile.path.should.equal('test/fixtures/pass with spaces.scss');
            newFile.scsslint.success.should.equal(true);
            ++fileCount;
         });

         stream.once('end', function() {
            fileCount.should.equal(1);
            done();
         });

         stream.write(file);
         stream.end();
      });

   });
});
