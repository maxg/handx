<?php
require 'course-setup.php';

$origin = $_SERVER['HTTP_ORIGIN'];
if (in_array($origin, $HANDOUT_ORIGINS)) {
  // allow CORS
  header("Access-Control-Allow-Origin: $origin");
  // send cookies with CORS
  header('Access-Control-Allow-Credentials: true');
}

header('Content-Type: text/plain');
print "\n";

$json = json_decode($_POST['visible']);
$visible = is_array($json) ? $json : [];

$log = implode("\t", array(
  date('c'),
  $_SERVER['REMOTE_ADDR'],
  $_COOKIE['shibauth'],
  str_replace($_SERVER['HTTP_ORIGIN'], '', $_SERVER['HTTP_REFERER']),
  $_POST['id'], # handout ID
  reset($visible), # first visible element
  end($visible) # last visible element
));
file_put_contents('log/access-' . date('Y-m-d') . '.log', "$log\n", FILE_APPEND | LOCK_EX);
?>
