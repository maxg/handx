/*
 * Handout Delivery
 *
 * Server-side pre-rendering of Markdown handouts.
 *
 * Can remove exercise solution data to separate JSON files.
 *
 * Pre-render a one-page handout without removing exercise solutions:
 *  $ phantomjs web/handout/deliver/deliver.phantom.js \
 *              classes/00-hello/handout/index.html delivered/classes/00-hello/handout/index.html
 *
 * Pre-render and remove exercise solutions:
 *  $ phantomjs web/handout/deliver/deliver.phantom.js \
 *              classes/00-hello/handout/index.html delivered/classes/00-hello/handout/index.html \
 *              delivered/exercises classes 07-designing-specs
 *
 * Pre-render and remove exercise solutions with a multi-page handout:
 *  $ phantomjs web/handout/deliver/deliver.phantom.js \
 *              classes/00-hello/handout/world/index.html delivered/classes/00-hello/handout/world/index.html \
 *              delivered/exercises classes 07-designing-specs world
 */

var fs = require('fs');
var page = require('webpage').create();
var system = require('system');

function exit(err) {
  console.error(err);
  phantom.exit(1);
}

if ([3, 6, 7].indexOf(system.args.length) < 0) {
  throw exit('usage: deliver.phantom.js source.html target.html [json-dir kind handout [part]]');
}

var backup = '.' + new Date().toISOString().replace(/\W/g, '');

// source HTML file
var source = fs.absolute(system.args[1]);
// target HTML file
var html = fs.absolute(system.args[2]);

// target directory for JSON file
if (system.args[3]) {
  var kind = system.args[4];
  if (/[^\w-]/.test(kind)) { throw exit('invalid kind "' + kind + '"'); }
  var handout = system.args[5];
  if (/[^\w-]/.test(handout)) { throw exit('invalid handout "' + handout + '"'); }
  var part = system.args[6] || null;
  if (part !== null && /[^\w-]/.test(part)) { throw exit('invalid part "' + part + '"'); }
  
  // construct an identifier for this (part of a) handout
  var handoutID = (kind + '-' + handout + (part ? '-' + part : '')).replace(/[^\w-]+/g, '-');
  
  // target JSON file
  var json = fs.absolute(system.args[3] + fs.separator + handoutID + '.json');
} else {
  var json = undefined;
}

if ( ! fs.exists(source)) {
  throw exit('source HTML file "' + source + '" does not exist');
}
if (fs.exists(html)) {
  fs.move(html, html + backup);
}
if (json && fs.exists(json)) {
  fs.move(json, json + backup);
}

page.onConsoleMessage = function(msg, lineno, source) {
  console.log('<'+source+':'+lineno+'>', msg);
};

page.onError = function(msg, trace) {
  console.log('error', msg, trace);
  phantom.exit(1);
};

page.onResourceError = function(err) {
  console.log('resource error', err.url, err.errorString);
  phantom.exit(2);
};

page.onCallback = function(hasExercises) {
  
  if (json && hasExercises) {
    // serialize solutions
    var exercises = page.evaluate(function(kind, handout, part) {
      return handoutExerciseJSON({
        kind: kind,
        handout: handout,
        part: part,
        exercises: window.handoutExercises,
      });
    }, kind, handout, part);
    
    // remove solutions from the page
    page.evaluate(function(handoutID) {
      $('.exercise-panel').attr('data-ex-remote', HANDOUT_EXERCISES + 'submit.php')
                          .attr('data-ex-handout', handoutID);
      $('.exercise-choice').removeAttr('data-ex-expected');
      $('.exercise-choice').removeAttr('data-ex-regex');
      $('.exercise-choice *').removeAttr('data-form-value');
      $('.exercise-answer').addClass('exercise-remote').html('(missing answer)');
      $('.exercise-explain').addClass('exercise-remote').html('<p>(missing explanation)</p>');
    }, handoutID);
    
    // save solutions
    fs.write(json, exercises, { mode: 'w', charset: 'UTF-8' });
  }
  
  var comment = '<!-- Handout delivered ' + new Date() + ' -->';
  
  // save handout
  fs.write(html, page.content + comment, { mode: 'w', charset: 'UTF-8' });
  
  phantom.exit(0);
};

page.open('file://' + source, function(status) {
  page.evaluate(function() {
    function callback() {
      window.callPhantom(window.handoutExercises.length > 0);
    }
    if (window.handoutReady) { return callback(); }
    var currentOnHandoutReady = window.onHandoutReady;
    window.onHandoutReady = function() {
      if (currentOnHandoutReady) { currentOnHandoutReady(); }
      callback();
    };
  });
});
