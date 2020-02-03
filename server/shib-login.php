<?php

require 'course-setup.php';

function error($msg) { throw new Exception($msg); }

defined('SHIBAUTH_FS') && defined('SHIBAUTH_WEB') or error('not configured');
$id = $_COOKIE['shibauth'];
preg_match('/[^0-9a-f]/', $id) and error('invalid session');
try {
  $id or error('no session');
  $data = file_get_contents(SHIBAUTH_FS."/sessions/sess_$id") or error('unknown session');
  $session = json_decode($data) or error('broken session');
  $_SESSION['username'] = $session->username or error('no username');
  ?>
  <title>handx login</title>
  <p>Logged in as <?=$_SESSION['username']?>, please close this tab.</p>
  <script>if (window.opener) { window.opener.postMessage('done', '*'); }</script>
  <?
} catch (Exception $e) {
  header('Location: '.SHIBAUTH_WEB."/auth.php?return_to=${_SERVER['REQUEST_URI']}");
}
?>
