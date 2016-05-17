<?php
$_SESSION['username'] = explode('@', $_SERVER['SSL_CLIENT_S_DN_Email'])[0];
header('Location: ../status.php');
?>
