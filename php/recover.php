<html>
<head>
<title>handx recovery</title>
<style>
@import url(https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css);
@import url(course-style.css);
</style>
</head>
<body>
<div class="container">
<h1>Recover lost records</h1>
<?php

require 'course-setup.php';

$username = array_key_exists('username', $_SESSION) ? $_SESSION['username'] : null;

if ($username !== explode('@', OWNER)[0]) {
  echo "<p><a href='status.php'>Log in</a></p>";
  exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo "<form method='post'><input class='btn btn-warning' type='submit'></input></form>";
  exit();
}

$losts = array_filter(scandir('log'), function($f) {
  return preg_match('/^lost-.*\.json/', $f);
});

foreach($losts as $lost) {
  $file = "log/$lost";
  echo "<h2>$lost</h2>";
  $jsons = file($file);

  foreach($jsons as $json) {
    echo "<div><code>$json</code></div>";

    $result = omnivore($json);
    if ($result === false) {
      echo "<h3>failed</h3>";
      continue 2; // skip remaining and renaming
    } else {
      echo "<h4>OK</h4>";
    }
  }
  // success on all lost records
  echo "<h3>done</h3>";

  rename($file, str_replace('/lost-', '/found-', str_replace('.json', '-' . date('YmdHis') . '.json', $file)));
}

echo "<h1>... done</h1>";

// TODO eliminate duplication from submit.php
function omnivore($json) {
  $private_key = openssl_pkey_get_private('file://data/omni-private-key.pem');
  openssl_sign($json, $bin_signature, $private_key, 'sha256');
  $signature = base64_encode($bin_signature);

  $url = sprintf('%s/%s/%s/api/v2/multiadd', OMNIVORE, COURSE, SEMESTER);
  $options = array('http' => array(
    'method' => 'POST',
    'header' => array('Content-Type: application/json',
                      "X-Omnivore-Signed: handx $signature"),
    'content' => $json));

  //print_r(array('json' => $json, 'url' => $url, 'signature' => $signature));

  return file_get_contents($url, false, stream_context_create($options));
}

?>
</div>
</body>
</html>
