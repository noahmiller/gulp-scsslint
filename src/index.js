/*jshint node:true */

'use strict';

var child_process = require('child_process');
var map = require('map-stream');
var gutil = require('gulp-util');
var xml2js = require('xml2js');
var xmlparser = new xml2js.Parser({
   explicitArray: true
});

var reporters = require('./reporters');

// Consts
var PLUGIN_NAME = 'gulp-scsslint';

// SCSS-Lint return code when a lint error or warning was found.
// https://github.com/causes/scss-lint/blob/master/lib/scss_lint/cli.rb
var LINT_ERROR_CODE = 65;

// Other SCSS-Lint return codes, unrelated to SCSS errors / warnings.
var SCSS_ERROR_CODES = {
  '64': 'Command line usage error',
  '66': 'Input file did not exist or was not readable',
  '70': 'Internal software error',
  '78': 'Configuration error'
};

// Shell return code when scss-lint cannot be found.
var COMMAND_NOT_FOUND = 127;

/**
 * Convert the given XML string to an error report object in the form:
 *    {
 *       filePath: [issue, issue]
 *    }
 * The issue objects contain properties matching those in the XML output
 * of SCSS-Lint (https://github.com/causes/scss-lint#xml), e.g. line and reason.
 *
 * If the XML contains no errors, and empty object will be provided.
 */
var xmlToErrorReport = function(xml, cb) {
   xml = xml || '';

   xmlparser.parseString(xml, function (err, data) {
      var errorsInFiles = {};

      // data.lint[0].file is an array of objects with file name and issues.
      // For each of those, add the issues array to errorsInFiles with the
      // file name as the key.
      if (data && data.lint && data.lint.file) {
         data.lint.file.forEach(function(fileData) {
            errorsInFiles[fileData.$.name] = fileData.issue.map(function(issue){
               return issue.$;
            });
         });
      }

      cb(err, errorsInFiles);
   });
};

/**
 * Return a status object for the given file.  If there are no errors, returns:
 *    { success: true }
 *
 * If errorsInFiles contains errors for the given file, then returns an object
 * with the following properties:
 *    - success: false
 *    - errorCount: integer, count of results
 *    - results: array of objects with properties matching the issue element
 *       properties of SCSS-Lint XML output (https://github.com/causes/scss-lint#xml).
 */
var formatOutput = function(file, errorsInFiles) {
   var filePath = (file.path || 'stdin');
   var errors = errorsInFiles[filePath];

   if (!errors || !errors.length) {
      return {
         success: true
      };
   }

   var output = {
      success: false,
      errorCount: errors.length,
      results: errors
   };

  return output;
};

/**
 * The main entry point for this plugin.
 *
 * @param options May be a string (config file pat) or an object with
 * option properties.
 *
 * Options:
 * - config: path to scss-lint.yml config file
 * - bin: the scss-lint call signature, e.g. 'bundle exec scss-lint'
 */
var scssLintPlugin = function(options) {
   // Handle when options is a config file path
   if ('string' === typeof options) {
      options = { config: options };
   }
   if (!options) options = {};
   var args = [];
   var config = options['config'];
   var bin = options['bin'] || 'scss-lint';

   args.push(bin);

   if (config) {
      args.push('-c');
      args.push(config);
   }

   // Get XML output so it's easy to parse errors
   args.push('-f XML');

   /**
    * If error.code is non-zero and does not represent a lint error,
    * then returns a PluginError.
    */
   function createExecError(error, bin) {
      var pluginError;
      var code = error && error.code;
      if (code && LINT_ERROR_CODE !== error.code)
      {
         var msg;
         if (COMMAND_NOT_FOUND === code) {
            msg = bin + ' could not be found\n';
            msg += '1. Please make sure you have ruby installed: `ruby -v`\n';
            msg += '2. Install the `scss-lint` gem by running:\n';
            msg += 'gem update --system && gem install scss-lint';
         } else if (SCSS_ERROR_CODES[code]) {
            msg = SCSS_ERROR_CODES[code];
         } else {
            msg = 'scss-lint exited with code ' + code;
         }
         if (msg) pluginError = new gutil.PluginError(PLUGIN_NAME, msg);
      }
      return pluginError;
   }

   /**
    * Runs the scss-lint binary using args with the given filePaths.
    */
   function runScssLint(filePaths, cb) {
      // Escape spaces in file paths
      filePaths = filePaths.map(function(path) {
         return path.replace(/(\s)/g, "\\ ");
      });

      var execOptions = args.concat(filePaths).join(' ');

      // Start the server
      var child = child_process.exec(execOptions, {
         cwd: process.cwd(),
         stdio: 'inherit'
      }, cb);
   }

   return map(function(file, cb) {
      if (!file) cb(null, file);

      runScssLint([file.path], function(error, stdout, stderr) {
         // Check for a non-lint error from the scss-lint binary
         var execError = createExecError(error, bin);
         if (execError) {
            cb(execError, file);
         } else {
            // Parse the returned XML and add a success or error object
            // to the file in the stream.
            xmlToErrorReport(stdout, function(err, errorsInFiles) {
               file.scsslint = formatOutput(file, errorsInFiles);
               cb(null, file);
            });
         }
      });
   });
};

// Expose the reporters
scssLintPlugin.failReporter = reporters.fail;
scssLintPlugin.reporter = reporters.reporter;

// Export the plugin main function
module.exports = scssLintPlugin;
