<?php

require 'course-setup.php';

$post = file_get_contents('php://input');

$sign = $_SERVER['HTTP_X_HANDX_SIGNATURE'];
const ALGORITHM = 'sha1';
if ($sign != ALGORITHM . '=' . hash_hmac(ALGORITHM, $post, $WWW_SECRET)) {
  header($_SERVER['SERVER_PROTOCOL'] . ' 403 Forbidden');
  exit();
}

$rev = $_SERVER['HTTP_X_HANDX_REVISION'];
if ( ! $rev) {
  header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
  exit();
}

$updated = $_SERVER['HTTP_X_HANDX_UPDATED'];
if ( ! $updated) {
  header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
  exit();
}
$updated = explode(',', $updated);
print "revision $rev updated handouts: " . implode(',', $updated) . "\n";

$tar = 'data/incoming/' . $rev . '.tar';

file_put_contents($tar, $post, LOCK_EX);

$ok = true;
foreach ($updated as $handout) {
  $ok = exec('/bin/bash data/incoming/deploy.sh ' . $handout . ' ' . $tar . ' ' . $WWW_FS . ' data 2>&1', $output, $retval) !== false && $ok;
  print "updated $handout: $retval\n";
}

print implode("\n", $output);

if ($ok) {
  unlink($tar);
}
?>
