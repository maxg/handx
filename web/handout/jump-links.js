
// assign IDs to content chunks, and create # links in the margin so that user can obtain a link there

// spec: {
//    jumpable: string, jQuery selector of elements that should get jump links
//    exclude: string, jQuery selector of elements to exclude from jumpable
//    nest: { selector:string -> selector:string }
// }
function makeJumpLinks(spec) {
  var jumpable = spec.jumpable;
  var exclude = spec.exclude;
  var nest = spec.nest;
  var elements = $(jumpable).not(':has(' + jumpable + ')').not(exclude);
  var chunks = {};
  var stopwords = [
    'a', 'an', 'and', 'are', 'as', 'at', 'by', 'for', 'from', 'has', 'have', 'how',
    'in', 'is', 'it', 'it-s', 'its', 'let-s', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
    'was', 'we', 'were', 'we-ll', 'we-re', 'what', 'when', 'where', 'who', 'will', 'with',
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
  elements.filter('[id]').each(function(idx, elt) {
    var parent = $(elt);
    $.each(nest, function(outer, inner) {
      if (parent.is(outer)) {
        parent = $(inner, parent).not(':empty').first();
        return false;
      }
    });
    parent.prepend($('<a>').addClass('jump').attr('href', '#' + elt.id));
  });
}
