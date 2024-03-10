<html>
<head>
<title>handx status</title>
<style>
@import url(https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css);
@import url(course-style.css);
.panel, .panel-body > :last-child {
  margin-bottom: 0;
}
</style>
</head>
<body>
<div class="panel panel-danger">
<div class="panel-body text-center">
<?php

require 'course-setup.php';

if (MAINTENANCE) {
  echo '<p>Exercise submission is <b>down for maintenance</b>.<br>Sorry about that!</p>';
} else if (@$_SESSION['username']) {
  echo '<p>Logged in: <code>'.$_SESSION['username'].'</code></p>';
  if (defined('MOTD')) { echo '<p>'.MOTD.'</p>'; }
} else if (defined('LOGIN_UNTIL') && (date('Y-m-d') > LOGIN_UNTIL)) {
  echo '<p>You are not logged in.</p>';
} else {
  echo '<p>You are not logged in.</p>';
  if (LOGIN_MODE == 'certificate') {
    ?>
    <p><a class="btn btn-danger btn-block" href="cert/login.php">Log in</a></p>
    <p>to receive credit for reading exercises.</p>
    <?
  } else if (LOGIN_MODE == 'shibauth' && defined('SHIBAUTH_FS') && defined('SHIBAUTH_WEB')) {
    ?>
    <p><a class="btn btn-danger btn-block" target="handx-login" href="shib-login.php">Log in</a></p>
    <p>to receive credit for reading exercises.</p>
    <script>
      document.querySelector('a[target=handx-login]').addEventListener('click', function(e) {
        var popup = window.open(this.getAttribute('href'));
        this.classList.add('disabled');
        window.addEventListener('message', function() {
          popup.close();
          window.location.reload();
        });
        e.preventDefault();
      });
    </script>
    <?
  } else {
    echo '<p>Exercise submission is not available.</p>';
  }
}

?>
</div>
</div>
</body>
</html>
