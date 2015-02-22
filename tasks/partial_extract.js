/*
 * grunt-partial-extract
 * https://github.com/tilmanjusten/grunt-partial-extract
 *
 * Copyright (c) 2014 Tilman Justen
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    var util = require('util');
    var _ = require('lodash');
    var path = require('path');
    var options = {};

    grunt.registerMultiTask('partial-extract', 'Extract partials from any text based file and write to distinct file.', function () {
        // Merge task-specific and/or target-specific options with these defaults.
        options = this.options({
            pattern: [
                /<\!--\s*extract:\s*(([\w\/-_]+\/)([\w_\.-]+))(.*)-->/,
                /<\!--\s*endextract\s*-->/
            ],
            // wrap partial
            partialWrap: {
                before: '<template id="partial" {{options}}>',
                after:  '</template>'
            },
            wrap: [],
            // base directory
            base: './inventory',
            // Store partials as distict file
            storePartials: true,
            // set indent
            indent: '    '
    });

        grunt.log.writeln('Destination: ' + options.base);
    grunt.verbose.writeln('Files: ' + this.files.length);
    grunt.log.writeln();

    var existingFiles = [];

    // Iterate over all specified file groups.
    this.files.forEach(function(file) {
      var content = grunt.util.normalizelf(grunt.file.read(file.src));

      if (!options.pattern[0].test(content)) {
        grunt.log.errorlns('No partials in file ' + file.src);
        grunt.verbose.writeln();

        return;
      }

      var lines = content.split(grunt.util.linefeed);
      var blocks = getPartials(lines);
            var origin = file.src;

      grunt.log.oklns('Found ' + blocks.length + ' partials in file ' + file.src);

            function filterByDest(block) {
        if (existingFiles.indexOf(block.dest) !== -1) {
          grunt.verbose.warn("Skip file " + block.dest + " which already exists.");
          return false;
                }

          return true;
        }

            // Write blocks to separate files
            blocks.filter(filterByDest).map(function (block) {
                if (!filterByDest(block)) {
                    return;
                }

        var lines = block.lines.map(properIndentation);
        var leadingWhitespace = lines.map(countWhitespace);
        var crop = leadingWhitespace.reduce(getLeadingWhitespace);
        var wrap = block.options.wrap || options.wrap;
                var partialWrapOptions = optionsToDataString(block.options);

        lines = trimLines(lines, crop);

                var templateLines = util._extend([], lines);

        // wrap partial if inline option wrap: exists
        if (wrap.length) {
          lines = raiseIndent(lines);
          lines.unshift('');
          lines.unshift(block.options.wrap[0] || '');
          lines.push('');
          lines.push(block.options.wrap[1] || '');
        }

        // add partialWrap
                if (typeof options.partialWrap === 'object') {
                    var before = options.partialWrap.before || '';
                    var after = options.partialWrap.after || '';

                    before = before.replace('{{options}}', partialWrapOptions);
                    after = after.replace('{{options}}', partialWrapOptions);

                    templateLines.unshift(before);
                    templateLines.push(after);
        }

                block.template      = templateLines.join(grunt.util.linefeed);
                block.optionsData   = partialWrapOptions;
                block.origin        = origin;

        existingFiles.push(block.dest);

                if (options.storePartials) {
                    grunt.file.write(path.resolve(options.base, options.partials, block.dest), block.template);
                }
      });

      grunt.verbose.writeln();
    });

    grunt.log.oklns('Extracted ' + existingFiles.length + ' unique partials.');
  });

  /**
   * extract partials
   *
   * @param lines
   * @returns {Array}
   */
  function getPartials(lines) {
    var block;
    var add = false;
        var matches;
    var match;
    var blocks = [];
        var dest = '';
        var matchFilename;
        var matchPath;
        var matchCategory;
        var matchName;
        var path = '';
        var filename = '';
        var category = false;
        var blockOptions = {};
        var name = '';

    // Import blocks from file
    lines.forEach(function (line) {
            // add block to list and stop adding lines when close annotation is present in current line
      if (line.match(options.pattern[1])) {
        add = false;
        blocks.push(block);
      }

            // add lines if set in previous step until a close annotation is reached
      if (add) {
        block.lines.push(line);
      }

            // create block if opening annotation is present in current line
            if (matches = line.match(options.pattern[0])) {
        add = true;
                match = matches[1];
                blockOptions = getBlockOptions(matches[0]);

                // get filename from extract option
                matchFilename = match.match(/\/([^\/^\s]+)$/i);
                filename = (matchFilename.length > -1) ? matchFilename[1] : match;

                // get path from extract option
                matchPath = match.match(/^([^\s]+\/)/i);
                path = (matchPath.length > -1) ? matchPath[1] : '';

                // set first folder as category name if not in item options
                if (!blockOptions.hasOwnProperty('category')) {
                    matchCategory = match.match(/^([^\s\/]+)\//i);
                    category = (matchCategory.length > -1) ? matchCategory[1] : false;
                    category = typeof category === 'string' ? _.startCase(category) : false;
                } else {
                    category = blockOptions.category;
                }

                // get name from filename if not in options
                if (!blockOptions.hasOwnProperty('name')) {
                    matchName = filename.match(/^([^\s]+)\./i);
                    name = (matchName.length > -1) ? matchName[1] : '';
                    name = typeof name === 'string' ? _.startCase(name) : '';
                } else {
                    name = blockOptions.name;
                }

                // remove nested path from dest if required
                dest = options.flatten ? filename : match;

                // prepare block data
                block = {
                    name: name,
                    category: category,
                    options: blockOptions,
                    path: path,
                    filename: filename,
                    dest: dest,
                    lines: []
                };
      }
    });

    return blocks;
  }

  /**
     * replace tabs by indent value
   *
   * @param line
   * @return string
   */
  function properIndentation(line) {
        return line.replace(/\t/, options.indent || '');
  }

  /**
   * count leading whitespace chars
   *
   * @param line
   * @return integer
   */
  function countWhitespace(line) {
    // return a somewhat high value for empty lines
    return line.length ? line.match(/^\s*/)[0].length : 9999;
  }

  /**
   * get lowest value of leading whitespace in a given block
   *
   * @param previous
   * @param current
   * @returns integer
   */
  function getLeadingWhitespace(previous, current) {
    return previous <= current ? previous : current;
  }

  /**
   * trim given number of leading characters
   *
   * @param lines
   * @param num Number of chars to be removed
   * @returns Array
   */
  function trimLines(lines, num) {
    return lines.map(function (line) {
      return line.substr(num);
    });
  }

  /**
   * read options from annotation
   *
   * e.g.: <!-- extract:teaser/content-teaser--small.html wrap:['<div class="teaser-list teaser-list--small">','</div>'] -->
   * gets:
   * {
   *   extract: 'teaser/content-teaser--small.html',
   *   wrap: [0: '<div class="teaser-list teaser-list--small">', 1: '</div>']
   * }
   *
   * @param annotation
   * @returns {{}}
   */
  function getBlockOptions(annotation) {
    var optionValues = annotation.split(/\w+\:/).map(function (item) {
      return item.replace(/<\!--\s?|\s?-->|^\s+|\s+$/, '');
    }).filter(function (item) {
      return item.length || false;
    });
    var optionKeys = annotation.match(/(\w+)\:/g).map(function (item) {
      return item.replace(/[^\w]/, '');
    });

    var opts = {};
    var patternMultiple = new RegExp(/\:/);

    optionValues.forEach(function (v, i) {
      var k = optionKeys[i];

      if (typeof k != 'string') {
        return;
      }

      // Treat option value as array if it has a colon
      // @todo: Allow escaped colons to be ignored
      // RegEx lookbehind negate does not work :(
      // Should be /(?<!\\)\:/
      if (v.match(patternMultiple)) {
        v = v.split(patternMultiple);
      }

      opts[k] = v;
    });

    return opts;
  }

  /**
   * raise offset in lines
   *
   * @param lines
   * @param offset
   * @returns {Array}
   */
  function raiseIndent(lines, offset) {
    offset = offset || '    ';

    return lines.map(function (line) {
      return offset + line;
    });
  }

    /**
     * Format options as string of HTML data parameters
     *
     * @param options
     * @returns {string}
     */
    function optionsToDataString(options) {
        if (typeof options !== 'object') {
            return '';
        }

        var prepared = [];
        var el;

        for (el in options) {
            if (options.hasOwnProperty(el) === false) {
                continue;
            }

            var value = options[el];
            var preparedVal = JSON.stringify(options[el]);
            var param = '';

            // Ignore callbacks
            if (typeof value === 'function') {
                continue;
            }

            // Cleanup: Remove leading and trailing " and ', replace " by ' (e.g. in stringified objects)
            preparedVal = preparedVal.replace(/^[\'\"]|[\'\"]$/g, '').replace(/\\?\"/g, '\'');

            // Build data parameter: data-name="value"
            param = 'data-' + el + '="' + preparedVal + '"';

            prepared.push(param);
        }

        return prepared.join(' ');
    }
};
