# gulp-scsslint

[![Build Status](https://travis-ci.org/noahmiller/gulp-scsslint.svg?branch=master)](https://travis-ci.org/noahmiller/gulp-scsslint)

> [SCSS-Lint](https://github.com/causes/scss-lint) plugin for [gulp](http://gulpjs.com).

[scss-lint](https://github.com/causes/scss-lint) is a Ruby gem written by
[The Causes Engineering Team](https://github.com/causes).
This plugin wraps the scss-lint binary for gulp and provides
default and failure reporters.


## Install

    npm install gulp-scsslint --save-dev

This plugin requires [Ruby](http://www.ruby-lang.org/en/downloads/)
and [scss-lint](https://github.com/causes/scss-lint#installation)
to be installed. If you're on OS X or Linux you probably already have
Ruby installed.

From a terminal:

```sh
ruby -v # test that Ruby is installed
gem update --system && gem install scss-lint
```

## Usage

```javascript
var scsslint = require('gulp-scsslint');
var gulp = require('gulp');

gulp.task('lint', function() {
  gulp.src('./styles/*.scss')
    .pipe(scsslint())
    .pipe(scsslint.reporter());
});
```

## API

### scsslint(configFile)

#### configFile
Type: `String`

You can pass the path to your .scss-lint.yml file directly to the plugin,
though if your config file uses the standard file name and location
then SCSS-Lint will find it by default.

```javascript
gulp.src('./styles/*.scss')
  .pipe(scsslint('my-scss-lint.yml'))
});
```

### scsslint(options)

#### options
Type: `Object`

##### `config`

Path to your .scss-lint.yml file.  Default is `undefined`.

##### `bin`

The scss-lint call signature.  Default is `scss-lint`.  In the context of
bundler, `bundle exec scss-lint` might be preferable.

##### `exclude`

Any files to exclude from the linting process. 

Single file:

```javascript
gulp.src('./styles/*.scss')
  .pipe(scsslint({exclude:'folder/_file.scss'}))
});
```
Multiple files:

```javascript
gulp.src('./styles/*.scss')
  .pipe(scsslint({exclude:['folder/_file.scss', 'folder2/_file2.scss']}))
});
```

## Results

Adds the following properties to the file object:

```javascript
  file.scsslint.success = true; // or false
  file.scsslint.errorCount = 0; // number of errors returned by SCSS-Lint
  file.scsslint.results = []; // SCSS-Lint errors
```

The objects in `results` have all the properties of the `issue` tags in
SCSS-Lint's [XML output](https://github.com/causes/scss-lint#xml), for example:

```javascript
file.scsslint.results = [{
  'line': 123,
  'column': 10,
  'severity': 'warning', // or `error`
  'reason': 'a description of the error'
}]
```

## Reporters

### Default

The default reporter logs SCSS-Lint warnings and errors using a format
similar to SCSS-Lint's default.

```javascript
stuff
  .pipe(scsslint())
  .pipe(scsslint.reporter())
```

Example output:

```
test/fixtures/error.scss:3 [E] Invalid CSS after "  font": expected ";", was ":"
test/fixtures/warning.scss:2 [W] Color `black` should be written in hexadecimal form as `#000`
```

### Fail Reporter

By default, only program errors cause errors to be emitted on the stream.
If you would also like SCSS-Lint warnings and errors to cause errors to be
emitted on the stream (for example, to fail the build on a CI server),
use the 'fail' reporter.

This example will log the errors using the default reporter, then fail
if SCSS-Lint found any issues in the SCSS.

```javascript
stuff
  .pipe(scsslint())
  .pipe(scsslint.reporter())
  .pipe(scsslint.reporter('fail'))
```

### Custom Reporters

Custom reporter functions can be passed as scsslint.reporter(reporterFunc).
The reporter function will be called for each linted file that includes
an error or warning and passed the file object as described above.

If the custom reporter returns non-falsey, the returned value will be
provided to the stream callback and will generate an error.

```javascript
var scsslint = require('gulp-scsslint');
var gulp = require('gulp');
var gutil = require('gulp-util');

var myReporter = function(file) {
  gutil.log(file.scsslint.errorCount + ' errors');
};

gulp.task('lint', function() {
  return gulp.src('./styles/*.scss')
    .pipe(scsslint())
    .pipe(scsslint.reporter(myReporter));
});
```

See `src/reports.js` for more detailed examples.
