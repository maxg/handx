handx
=====

**Markdown handouts + exercises**

### [`example/handout`](example/handout)

An example handout!

Clone this repository and open `example/handout/index.html`.

### [`example/slides`](example/slides)

Example slides!

Clone this repository and open `example/slides/index.html`.

### [`web/handout`](web/handout)

JavaScript and CSS for rendering and running handouts.

For local development, the handout HTML file includes `handout-render.js` to render the page in the browser.
`handout-render` then loads `handout-run.js` to handle exercises and interactive elements.
Exercise answers are checked locally.

For deployment, the handout HTML page is loaded in [PhantomJS] using `deliver/deliver.phantom.js`, pre-rendered, and the resulting HTML file only includes `handout-run`.
Exercise answers are also stripped from the file and checked server-side.

  [PhantomJS]: http://phantomjs.org

### [`scripts`](scripts)

Shell scripts for pre-rendering handouts.

`deliver-handouts` pre-renders a directory of handouts as described above.
It delivers HTML files to one directory, for display on the web, and JSON files with exercise answers to another directory, for use by the server-side exercise checker.

`repo-post-receive-hook` is designed for use with [Git Meta-Hooks] and `deliver-handouts-athena` on Athena.

  [Git Meta-Hooks]: https://github.com/maxg/git-meta-hooks

### [`server`](server)

Server-side exercise checking for use with [scripts.mit.edu] and [Omnivore].

`status.php` is shown in the right margin of exercise groups and allows the reader to log in via `cert/login.php`.

`submit.php` handles exercise submission.
It checks exercises using the JSON files delivered to `data` when handouts are pre-rendered.
It also reports results to an Omnivore grade server.

  [scripts.mit.edu]: https://scripts.mit.edu
  [Omnivore]: https://github.com/maxg/omnivore
