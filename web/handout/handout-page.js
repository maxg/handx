/*
 * Handout Page Renderer
 *
 * Renders a Markdown handout with embedded exercises.
 *
 * Removes itself and rendering scripts from the DOM after execution.
 */

HANDOUT_SCRIPTDIR = document.querySelector('script[src*=handout-page]').getAttribute('src').match(/.*\//)[0];

(function() {
  
  // load JavaScript by injecting a <script> tag
  function require(url, callback) {
    var deferred;
    if ( ! callback) {
      // if no callback function, return a Deferred that resolves when the script is loaded
      deferred = $.Deferred();
      callback = function(event) { deferred.resolve(event); }
    }
    
    // fix relative URLs
    url = url.replace('./', HANDOUT_SCRIPTDIR);
    
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.charset = 'utf-8';
    script.src = url;
    script.onerror = function(err) { throw err; }
    script.onload = callback;
    document.getElementsByTagName('body')[0].appendChild(script);
    
    return deferred;
  }
  
  //
  // main
  //
  
  // load jQuery, load other dependencies, and render
  require('https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js', function () {
    var stages = [
      [ './course-setup.js#render',
        './jump-links.js#render',
        './handout-render.js',
        './render/Markdown.Converter.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pluralize/7.0.0/pluralize.min.js#render',
        'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js' ],
      [ './render/Markdown.Extra.js',
        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js#render' ],
    ];
    (function next() {
      var scripts = stages.shift();
      
      // when all scripts are loaded, render and run
      if ( ! scripts) {
        renderPage();
        $('script[src*=handout-page], script[src*=render]').remove();
        require('./handout-run.js').done(function(event) {
          event.target.setAttribute('data-handx-url', HANDOUT_HANDX);
        });
        return;
      }
      // otherwise, require all scripts in this stage and recurse
      $.when.apply($, scripts.map(function(script) { return require(script) })).done(next);
    })();
  });
})();
