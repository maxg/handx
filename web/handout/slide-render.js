/*
 * Slide Renderer
 *
 * Renders Markdown slides.
 */

// load JavaScript by injecting a <script> tag
function require(url, callback) {
  var deferred;
  if ( ! callback) {
    // if no callback function, return a Deferred that resolves when the script is loaded
    deferred = $.Deferred();
    callback = function() { deferred.resolve(); }
  }
  
  // fix relative URLs
  url = url.replace('./', require.abspath);
  
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  script.onerror = function(err) { throw err; }
  script.onload = callback;
  document.getElementsByTagName('body')[0].appendChild(script);
  
  return deferred;
}

// render the page with all dependencies loaded
function render() {
  
  // presentation title, semester subtitle, authors
  $('#source').prepend([
    'class: chapter',
    '# ' + $('head title').text(),
    '## ' + HANDOUT_SEMESTER,
    HANDOUT_AUTHORS,
    '---\n'
  ].join('\n'));
  
  // convert presentation
  var show = remark.create({
    navigation: { scroll: false, touch: false },
    highlightStyle: null,
  });
  
  // colors
  $('.color').each(function() {
    var span = this;
    [].forEach.call(this.classList, function(name) {
      var match = name.match(/color-(.*)/);
      if (match) { span.style.color = '#' + match[1]; }
    });
  });
  
  // countdown timers
  addSlideTimerManager(show);
  
  if (window.onSlideshowDidRender) { window.onSlideshowDidRender(show); }
}

// slides with class "timer" get a countdown timer
// use a class of the form "timer-M-SS" to specify duration in minutes and seconds
function addSlideTimerManager(show) {
  
  var timer = null;
  
  function start() {
    var started = new Date();
    
    var duration = 60; // 1-minute default
    [].forEach.call(this.classList, function(name) {
      var match = name.match(/timer-(\d+)-(\d\d)/);
      if (match) { duration = parseInt(match[1]) * 60 + parseInt(match[2]); }
    });
    
    var clock = $('<div>').addClass('remark-slide-timer');
    $(this).append(clock);
    
    function update(force) {
      var time = new Date() - started;
      var remaining = duration - Math.round(time/1000);
      
      if (remaining <= 0) {
        clock.addClass('remark-slide-timer-expired');
        stop();
      }
      
      var minutes = Math.floor(remaining/60);
      var seconds = Math.floor(remaining) % 60;
      if (force || remaining < 15 || seconds % 15 == 0) { // only update every 15 seconds until last 15 seconds
        clock.text(minutes + (seconds > 9 ? ':' : ':0') + seconds);
      }
    }
    update(true);
    timer = setInterval(update, 1000);
  }
  
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  
  show.on('showSlide', function() {
    setTimeout(function() {
      stop();
      $('.remark-slide-content .remark-slide-timer').remove();
      $('.remark-slide-container.remark-visible .remark-slide-content.timer:not(.no-timer)').each(start);
    }, 0);
  });
}

//
// main
//

// load jQuery, load other dependencies, and render
require('https://ajax.googleapis.com/ajax/libs/jquery/2.2.0/jquery.min.js', function () {
  
  // future calls to require can use relative paths
  require.abspath = $('script[src*=slide-render]').attr('src').match(/.*\//)[0];
  
  var stages = [
    [ './course-setup.js', './run/remark.min.js' ],
  ];
  (function next() {
    var scripts = stages.shift();
    
    // when all scripts are loaded, render
    if ( ! scripts) { return render(); }
    
    // otherwise, require all scripts in this stage and recurse
    $.when.apply($, scripts.map(function(script) { return require(script) })).done(next);
  })();
});
