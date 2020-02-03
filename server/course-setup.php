<?php
/*
 * Course Exercise Server Configuration
 *
 * Customize me!
 */

const OWNER = 'webmaster@example.com';
$HANDOUT_ORIGINS = array('http://example.com', 'https://example.com');
const OMNIVORE = 'https://omnivore.example.com';
const COURSE = '6.HANDX';
const SEMESTER = 'ia00';
$HANDOUT_TOC_KINDS = array('classes');
const LOGIN_MODE = 'certificate'; // use 'certificate' or 'shibauth'
// with shibauth login mode: filesystem and web paths
// const SHIBAUTH_FS = '.../shibauth';
// const SHIBAUTH_WEB = '/shibauth';

// optional: message displayed in status box
const MOTD = 'Questions about the reading?<br><b>Better luck next time!</b></a>';
// optional: login is required to submit exercises until end of class
// const LOGIN_UNTIL = '2000-02-01';

const MAINTENANCE = false; // maintenance mode prevents submission
?>
