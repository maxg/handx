/*
 * Handout Renderer
 *
 * Renders Markdown handouts with embedded exercises.
 *
 * This script runs client-side for previews and server-side for production.
 * Must only perform static transformation of the DOM. Event handlers are the job of handout-run.js.
 *
 * Removes itself from the DOM after execution.
 */

// configuration
HANDOUT_PREVIEW = (document.location.protocol === 'file:') && ( ! window.callPhantom);

if (typeof HANDOUT_HANDX === "undefined") { HANDOUT_HANDX = false; }

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
  script.charset = 'utf-8';
  script.src = url;
  script.onerror = function(err) { throw err; }
  script.onload = callback;
  document.getElementsByTagName('body')[0].appendChild(script);
  
  return deferred;
}

// transform HTML, render Markdown and exercises
function render() {
  
  // encoding
  if ( ! $('head meta[charset]').length) {
    $('head').prepend($('<meta>').attr({ charset: 'utf-8' }));
  }
  // CSS
  $('head').append($('<link>').attr({ href: require.abspath + 'handout-style.css', rel: 'stylesheet' }));
  // page title
  var title = $('head title').text();
  $('main').prepend($('<h1>').addClass('handout-title').text(title));
  // bootstrappiness
  $('nav').addClass('col-sm-2');
  $('main').addClass('container-fluid');
  if ($('main').hasClass('fullpage')) {
    var column = 'col-sm-12';
  } else if ($('main').hasClass('widepage')) {
    var column = 'col-sm-10 col-sm-offset-1';
    $('body').prepend($('<div>').addClass('margin col-sm-1'));
  } else {
    var column = 'col-sm-8 col-sm-offset-2';
    $('body').prepend($('<div>').addClass('margin col-sm-2'));
  }
  $('h1, .markdown, .with-content').addClass(column);
  // mobile
  if ( ! $('head meta[name="viewport"]').length) {
    $('head').append($('<meta>').attr({ name: 'viewport', content: 'width=device-width, initial-scale=1' }));
  }
  
  // create Markdown converter
  var converter = new Markdown.Converter();
  Markdown.Extra.init(converter, {
    // note: changing the enabled extensions may break existing pages
    extensions: [ 'fenced_code_gfm', 'tables', 'def_list', 'attr_list', 'smartypants' ],
    highlighter: 'highlight',
    table_class: 'table',
  });
  
  // extend converter to understand form elements...
  converter.hooks.chain('postBlockGamut', convertMarkdownChoiceBlocks);
  converter.hooks.chain('postBlockGamut', convertMarkdownDropdowns);
  converter.hooks.chain('postBlockGamut', convertMarkdownTextFields);
  
  // extend converter to understand java:... URLs as links to API docs
  converter.hooks.chain('postConversion', function(html) {
    return html.replace(/ href="java:([^"]+)"/g, function(link, clazz) {
      return ' href="http://docs.oracle.com/javase/8/docs/api/?'+clazz+'.html"';
    });
  });
  
  if (window.HANDOUT_WILL_RENDER) { window.HANDOUT_WILL_RENDER(converter); }
  if (window.onHandoutWillRender) { window.onHandoutWillRender(converter); }
  
  // convert all Markdown divs
  $('.markdown:not(.converted)').each(function() {
    this.innerHTML = convertMarkdown(converter, this);
    $(this).addClass('converted');
  });
  
  var header = $('header').length ? $('header').first() : $('<header>').prependTo($('body'));
  // header link
  if ($('.table-of-contents').length) {
    header.before($('<header>').addClass('chip')
                               .append($('<a>').attr('href', HANDOUT_HOME)
                                               .text(HANDOUT_CLASS.match(/\S+/)[0])));
  }
  header.prepend($('<a>').attr('href', HANDOUT_HOME).text(HANDOUT_CLASS));
  // semester header
  header.append($('<div>').text(HANDOUT_SEMESTER));
  // copyright footer
  $('footer:contains("\u00a9")').addClass('col-sm-2 footer-margin').html($('<div>').html(HANDOUT_AUTHORS));
  // department footer
  $('body').append($('<footer>').text(HANDOUT_DEPARTMENT));
  
  // identify exercises
  $(HANDOUT_EXERCISES.map(function(category) {
    return '.' + category;
  }).join(',')).addClass('exercises');
  
  // assign IDs to all headers
  [ 'h1', 'h2', 'h3' ].forEach(function(h) { // higher-level headers get cleaner IDs
    $(h).each(function() {
      if ($(this).closest('.exercises').length) { return; }
      if ( ! this.id) { this.id = uniqueIdentifier('id', this.textContent); }
      var div = $('<div>').attr('data-outline', this.id);
      while (this.nextSibling &&  ! $(this.nextSibling).is(h)) {
        div.append(this.nextSibling);
      }
      $(this).after(div);
    });
  });
  
  // convert exercise blocks
  HANDOUT_EXERCISES.forEach(function(category) {
    $('.' + category + '.exercises:not(.converted)').each(function() {
      convertExercises(this, category);
      $(this).addClass('converted');
    });
  });
  $('.exercises').first().each(function() {
    if (HANDOUT_HANDX) {
      $('main').prepend($('<iframe class="exercises-status">').attr('src', HANDOUT_HANDX + 'status.php'));
    }
  });
  
  // convert video links
  $('.video').first().each(function() {
    $('main').append($('<div>').addClass('video-player col-md-6 col-sm-9 col-xs-12')
                               .append($('<button class="close video-close">&times;</button>'))
                               .append($('<div>').addClass('video-portal panel panel-default')
                                                 .append($('<div>').addClass('video-embed embed-responsive embed-responsive-16by9'))));
  });
  $('.video').each(function() {
    var location = $(this).parents().map(function() { return $(this).data('outline'); }).get().reverse().join(',');
    var title = $('p', this).last().remove().html();
    var link = $('<a>').addClass('video-play')
                       .attr('href', HANDOUT_VIDEO + location + '/' + $(this).data('video'))
                       .append($('<strong>').html('&#x25B6;&#xFE0E; Play ' + title));
    $(this).replaceWith($('<div>').addClass('video-status panel panel-info')
                                  .append($('<div>').addClass('panel-body text-center')
                                                    .append($(this).html())
                                                    .append(link)));
  });
  
  // Bootstrap-ify elements that have handout-* CSS classes
  $('.handout-info').addClass('alert alert-info');
  $('.handout-solo').addClass('alert alert-warning');
  $('.handout-group').addClass('alert alert-success');
  $('.handout-due').addClass('alert alert-danger');
  $('.handout-aside-info').addClass('handout-aside panel-info');
  $('.handout-aside-solo').addClass('handout-aside panel-warning');
  $('.handout-aside-group').addClass('handout-aside panel-success');
  $('.handout-aside-due').addClass('handout-aside panel-danger');
  $('.handout-aside').each(function() {
    $(this).addClass('panel panel-default pull-right');
    var heading = $(this).children().first().remove();
    var body = $(this).wrapInner($('<div>').addClass('panel-body'));
    $(this).prepend($('<div>').addClass('panel-heading')
                              .append($('<strong>').append(heading.html())));
  });
  
  // Bootstrap-ify generated HTML
  $('.alert a').addClass('alert-link');
  
  // assign IDs to content chunks
  identifyChunks($('.table-of-contents').length);
  
  // build table of contents
  $('.table-of-contents').each(function() {
    var toc = $('<ul>').addClass('nav');
    $('h1, .markdown h2, .with-content h2').each(function() {
      toc.append($('<li>').append($('<a>').text(this.textContent).attr('href', '#' + this.id)));
    });
    $(this).append(toc);
  });
  
  // syntax highlight code
  if ($('code[class^=language]').length > 0) {
    hljs.initHighlighting();
  }
  
  // handle Javadoc comments
  $('.hljs.language-java .hljs-comment').filter(function() {
    return $(this).text().indexOf('/**') === 0;
  }).addClass('handout-javadoc-comment');
  
  if (window.HANDOUT_DID_RENDER) { window.HANDOUT_DID_RENDER(); }
  if (window.onHandoutDidRender) { window.onHandoutDidRender(); }
}

// recursively convert a node containing Markdown and possibly HTML
function convertMarkdown(md, node, intoSpan) {
  var marker = '%converted%';
  while (node.outerHTML.indexOf(marker) >= 0) { marker += '%' };
  var saved = [];
  function save(html) {
    return '<p>' + marker + saved.push(html) + '</p>';
  }
  
  var needsConversion = false;
  var children = Array.prototype.map.call(node.childNodes, function(node) {
    if (node.nodeType == Node.TEXT_NODE) {
      // only need to call Markdown converter when there is text to convert
      needsConversion = needsConversion || /\S/.test(node.textContent);
      return node.textContent;
    }
    if (node.nodeType == Node.COMMENT_NODE) {
      return '\n';
    }
    if (node.classList.contains('no-markdown') || node.tagName == 'OBJECT') {
      return save(node.outerHTML);
    }
    if (node.tagName == 'BR') {
      return node.outerHTML;
    }
    return save(node.outerHTML.replace(node.innerHTML,
      convertMarkdown(md, node, [ 'SUB', 'SUP' ].indexOf(node.tagName) >= 0).trim()));
  });
  var text = children.join('');
  var html = needsConversion ? md.makeHtml((intoSpan ? '# ' : '') + text) : text;
  if (intoSpan) {
    html = html.replace(/<h1>(.*)<\/h1>/, '$1');
  }
  
  saved.forEach(function(result, idx) {
    html = html.replace('<p>' + marker + (idx+1) + '</p>', result);
  });
  
  //if (needsConversion) {
  //  console.log('convert', children, '\u2192', html);
  //} else {
  //  console.log('-------', children, '\u2713', html);
  //}
  return html;
}

// convert choice blocks
//   [ ] check boxes and ( ) radio buttons
//   [x] checked and (x) selected options are given a data-form-value attribute
function convertMarkdownChoiceBlocks(text, convert) {
  $.each({ checkbox: '[]', radio: '()' }, function(type, chars) {
    // one choice is: open char + maybe x + close char + indented lines
    var singleChoice = '^\\' + chars[0] + '([ x])\\' + chars[1] + '(.+$(\n    .*)*)';
    var multipleChoices = '(' + singleChoice + '\n)+';
    // find blocks of choices
    text = text.replace(new RegExp(multipleChoices, 'gm'), function(choices) {
      this.convertedChoiceBlocks = (this.convertedChoiceBlocks || 0) + 1;
      
      // convert individual choices
      var convertedChoices = 0;
      choices = choices.replace(new RegExp(singleChoice, 'gm'), function(choice, checked, label) {
        var id = 'md_converted_choice_' + this.convertedChoiceBlocks + '_' + convertedChoices++;
        var attrs = ' type="' + type + '" id="' + id + '"';
        if (/\S/.test(checked)) {
          attrs += ' data-form-value="check"';
        }
        if (type == 'radio') {
          // radio buttons must share the name attribute in order to enforce single selection
          attrs += ' name="' + 'md_converted_radio_' + this.convertedChoiceBlocks + '"';
        }
        // de-block recursive conversion of choice label
        label = convert(label).replace(/<p>([^]*)<\/p>/, '$1');
        return '<div class="' + type + '"><label for="' + id + '"><input' + attrs + '>' + label + '</label></div>';
      });
      // result of converting block is choices wrapped in a div
      return '<div class="form-group">' + choices + '</div>';
    });
  });
  return text;
}

// convert dropdown menus
//   [[ select, one, option ]]
//   [[ (selected), options ]] are given a data-form-value attribute
function convertMarkdownDropdowns(text) {
  // find dropdowns
  return text.replace(/^\[\[ *(`?)(.+?)(`?) *\]\]/gm, function(select, tt, options) {
    var clazz = 'dropdown';
    if (/\S/.test(tt)) {
      clazz += ' ttfont';
    }
    // convert individual options
    var options = options.split(',').map(function(option) {
      var option = /^(\(?)(.+?)(\)?)$/.exec(option.trim());
      var attrs = '';
      if (option[1] && option[3]) {
        attrs += ' data-form-value="select"';
      } else {
        option[2] = option.slice(1).join(''); // glue singleton ( and ) back on
      }
      return $('<option' + attrs + '>').text(option[2].trim()).prop('outerHTML');
    }).join();
    var blank = '<option selected="selected"></option>';
    return '<div class="form-group"><div class="' + clazz + '"><select class="form-control">' + blank + options + '</select></div>\n</div>';
  });
}

// convert text fields
//   = text is stored in a data-form-value attribute
function convertMarkdownTextFields(text) {
  // find textboxes
  return text.replace(/^= *(`?)(.+?)(`?) *$/gm, function(textbox, tt, value) {
    var clazz = 'textfield';
    if (/\S/.test(tt)) {
      clazz += ' ttfont';
    }
    value = value.replace(/\s+/g, ' ').trim();
    var width = 25 + Math.min(25, Math.max(0, value.length - 10));
    var input = $('<input type="text" class="form-control">').attr('data-form-value', encodeURIComponent(value)).css('width', width + '%');
    return '<div class="form-group"><div class="' + clazz + '">' + input.prop('outerHTML') + '</div>\n</div>';
  });
}

function convertExercises(node, category) {
  var categoryName = category.replace(/-/g, ' ');
  var section = $(node).parents('[data-outline]').slice(-2).first();
  var container = $(node).attr('id', uniqueIdentifier('id', 'ex-' + section.data('outline')))
                         .addClass('exercises panel-group')
                         .prepend('<h4 class="text-danger">' + categoryName + '</h4>');
  
  $('h1', container).each(function() {
    convertExercise(container, category, $(this), $(this).nextUntil('hr'));
  });
  
  // remove original exercise titles and dividers
  $('h1, hr', container).remove();
  // transform part labels
  $('h2', container).replaceWith(function() {
    return $('<label class="exercise-part-heading">').html(this.innerHTML);
  });
  // transform explanations
  $('blockquote', container).replaceWith(function() {
    return $('<div class="exercise-explain">').html(this.innerHTML);
  });
}

function convertExercise(container, category, heading, content) {
  var title = heading.text();
  var section = container.parents('[data-outline]').first();
  var exerciseName = uniqueIdentifier('data-outline', title, section);
  var exerciseId = container.attr('id') + '-' + exerciseName;
  var panel = $('<div class="panel panel-danger">')
              .append($('<div class="panel-collapse exercise-panel">')
                      .toggleClass('collapse', ! heading.hasClass('exercise-expand'))
                      .attr('id', exerciseId)
                      .attr('data-outline', exerciseName)
                      .attr('data-ex-id', section.data('outline') + '/' + exerciseName)
                      .attr('data-ex-category', category)
                      .attr('data-ex-no-iterate', heading.hasClass('exercise-no-iterate') || null)
                      .append('<div class="panel-body">'));
  var body = content.wrapAll(panel).parent();
  
  // parts
  $('.form-group', body).each(function(idx) {
    var group = $(this).addClass('exercise-part');
    
    var label = String.fromCharCode('a'.charCodeAt(0) + idx);
    group.attr('data-outline', uniqueIdentifier('data-outline', label, body));
    
    $('.checkbox, .radio, .dropdown, .textfield', this).addClass('exercise-choice')
                                                       .append($('<span class="exercise-answer">').hide());
    
    $('.checkbox, .radio', this).each(function(idx) {
      var choice = $(this);
      var input = $('input', this);
      var label = $('label', this);
      var text = label.text() || 'choice_' + (idx+1);
      choice.attr('data-outline', uniqueText('data-outline', text, group));
      choice.attr('data-ex-expected', input.data('form-value') == 'check');
    });
    
    $('.dropdown', this).each(function() {
      var choice = $(this);
      var input = $('select', this);
      var labels = $('option', input).map(function() { return this.text; }).get();
      choice.attr('data-outline', uniqueText('data-outline', labels.join('; '), group));
      choice.attr('data-ex-expected', encodeURIComponent($('option[data-form-value]', input).text()));
    });
    
    $('.textfield', this).each(function() {
      var choice = $(this);
      var input = $('input', this);
      var answerSpec = decodeURIComponent(input.data('form-value'));

      // check if the answer starts with a regex, and if so use it
      var m = answerSpec.match(/^(\/.+\/[im]*)\s*(.*)$/);
      if (m) {
        // store the regex and its explanation
        choice.attr('data-ex-regex', encodeURIComponent(m[1]));
        choice.attr('data-ex-expected', encodeURIComponent(m[2]));
      } else {
        // answer is just a plain string
        choice.attr('data-ex-expected', encodeURIComponent(answerSpec));
      }
    });
  });
  
  // header
  var head = $('<div class="panel-heading">')
             .append($('<span class="panel-title">').text(title)).attr({
               'id': '@' + exerciseId,
               'data-target': '#' + exerciseId,
               'data-toggle': 'collapse',
               // to collapse other exercises: 'data-parent': '#'+container.attr('id'),
             });
  body.parent().parent().prepend(head);
  
  // footer
  if (heading.hasClass('exercise-no-iterate')) {
    var submit = $('<button class="btn btn-default exercise-submit">').text('submit');
    var reveal = $();
  } else {
    var submit = $('<button class="btn btn-default exercise-submit">').text('check');
    var reveal = $('<button class="btn btn-default exercise-reveal">').text('explain').hide();
  }
  var foot = $('<div class="form-inline">')
             .append($('<div class="form-group">')
                     .append(submit, '&emsp;', reveal))
             .append($('<div class="exercise-progress progress"><div class="progress-bar progress-bar-danger progress-bar-striped active"></div></div>'))
             .append($('<div class="exercise-error"></div>'));
  body.append(foot);
}

function identifyChunks(dense) {
  var jumpable = 'h1, h2, h3, h4, h5, h6, .panel-heading' + (dense ? ', p, pre, ol>li:first-child, ul>li:first-child, table' : '');
  var exclude = '.exercise-explain *, .faq h3 + div > p:first-child';
  var elements = $(jumpable).not(':has(' + jumpable + ')').not(exclude);
  var chunks = {};
  var stopwords = [
    'a', 'an', 'and', 'are', 'as', 'at', 'by', 'for', 'from', 'has', 'have', 'how',
    'in', 'is', 'it', 'it-s', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
    'was', 'we', 'were', 'we-re', 'what', 'when', 'where', 'who', 'will', 'with',
  ];
  elements.map(function(idx, elt) {
    var words = $(this).text().toLowerCase().split(/\s+/).map(function(word) {
      return word.replace(/^\W+|\W+$/g, '').replace(/\W+/g, '-');
    }).filter(function(word) {
      return word && (stopwords.indexOf(word) < 0);
    });
    return { $elt: this, $words: words };
  }).each(function() {
    var here = chunks;
    while (this.$words.length) {
      var word = this.$words.shift();
      if ( ! here[word]) {
        here[word] = this;
        return;
      }
      if (here[word].$elt) {
        var current = here[word];
        here[word] = {};
        if ( ! current.$words.length) { return; }
        here[word][current.$words.shift()] = current;
      }
      here = here[word];
    }
  });
  var size = 3;
  (function labeler(labels, tree) {
    if (tree.$elt) {
      if ( ! tree.$elt.id) {
        Array.prototype.push.apply(labels, tree.$words.slice(0, (size - (labels.length % size)) % size));
        tree.$elt.id = '@' + labels.join('_');
      }
    } else {
      Object.keys(tree).forEach(function(key) {
        labeler(labels.concat(key), tree[key]);
      });
    }
  })([], chunks);
  elements.filter('[id]').prepend(function() {
    return $('<a>').addClass('jump').attr('href', '#' + this.id);
  });
}

function uniqueIdentifier(attr, text, context) {
  var base = text.toLowerCase().replace(/\s/g, '_').replace(/[^\w-]/g, '').replace(/([_-])\1+/g, '$1');
  var val = base;
  var idx = 2;
  while ($('['+attr+'="'+val+'"]', context || document).length) { val = base + '_' + idx++; }
  return val;
}

function uniqueText(attr, text, context) {
  function ESC(val) { return val.replace(/"/g, '\\$1'); }
  var base = text.replace(/\s+/g, ' ');
  var val = base;
  var idx = 2;
  while ($('['+attr+'="'+ESC(val)+'"]', context || document).length) { val = base + ' (' + idx++ + ')'; }
  return val;
}

//
// main
//

// load jQuery, load other dependencies, and render
require('https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js', function () {
  
  // future calls to require can use relative paths
  require.abspath = $('script[src*=handout-render]').attr('src').match(/.*\//)[0];
  
  var stages = [
    [ './course-setup.js#render',
      './render/Markdown.Converter.js',
      'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js' ],
    [ './render/Markdown.Extra.js',
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js#render' ],
  ];
  (function next() {
    var scripts = stages.shift();
    
    // when all scripts are loaded, render and run
    if ( ! scripts) {
      render();
      $('script[src*=render]').remove();
      require('./handout-run.js');
      return;
    }
    // otherwise, require all scripts in this stage and recurse
    $.when.apply($, scripts.map(function(script) { return require(script) })).done(next);
  })();
});
