/*jshint node:true */

'use strict';

var child_process = require('child_process');
var es = require('event-stream');
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

   xmlparser.parseString(xml, function (error, data) {
      if (error) {
         error.message = 'Parsing SCSS-Lint XML output failed: ' + error.message;
         error = new gutil.PluginError(PLUGIN_NAME, error);
      }

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

      cb(error, errorsInFiles);
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
   var exclude = options['exclude'];

   var stream;
   var files = [];

   args = args.concat(bin.split(/\s/));

   if (config) {
      args.push('-c');
      args.push(config);
   }

   if (exclude) {
      args.push('-e');
      args.push(exclude);
   }

   // Get XML output so it's easy to parse errors
   args.push('-fXML');

   /**
    * If code is non-zero and does not represent a lint error,
    * then returns a PluginError.
    */
   function createExecError(code, bin) {
      var pluginError;
      if (code && LINT_ERROR_CODE !== code)
      {
         var msg;
         if ('ENOENT' === code || COMMAND_NOT_FOUND === code) {
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
    * Spawns the scss-lint binary using args with the given filePaths
    * and returns the spawned process.
    */
   function spawnScssLint(filePaths) {
      var execOptions = args.concat(filePaths);
      var bin = execOptions.shift();

      // Run scss-lint
      return child_process.spawn(bin, execOptions, {
         cwd: process.cwd(),
         stdio: ['ignore', 'pipe', process.stderr]
      });
   }

   function queueFile(file) {
      if (file) files.push(file);
   }

   function endStream() {
      var filePaths = files.map(function(file) { return file.path; });
      var lint = spawnScssLint(filePaths);

      // Buffer XML output until the entire response has been provided.
      // LATER: consider streaming the XML
      var xml = '';
      lint.stdout.on('data', function(data) { xml += data; });

      // Handle spawn errors
      lint.on('error', function(error) {
         var execError = createExecError(error.code, bin);
         stream.emit('error', execError);
      });

      // On exit, handle lint output
      lint.on('exit', function(code) {
         // Check for a non-lint error from the scss-lint binary
         var execError = createExecError(code, bin);
         if (execError) {
            stream.emit('error', execError);
         } else {
            // Parse the returned XML and add scsslint objects
            // to the files in the stream.
            xmlToErrorReport(xml, function(error, errorsInFiles) {
               for (var i = 0; i < files.length; i++) {
                  var file = files[i];
                  file.scsslint = formatOutput(file, errorsInFiles);
                  stream.emit('data', file);
               }
               stream.emit('end');
            });
         }
      });
   }

   stream = es.through(queueFile, endStream);
   return stream;
};

// Expose the reporters
scssLintPlugin.failReporter = reporters.fail;
scssLintPlugin.reporter = reporters.reporter;

// Export the plugin main function
module.exports = scssLintPlugin;
