<?php
ob_start();

require 'course-setup.php';

$origin = $_SERVER['HTTP_ORIGIN'];
if (in_array($origin, $HANDOUT_ORIGINS)) {
  // allow CORS
  header("Access-Control-Allow-Origin: $origin");
  // send cookies with CORS
  header('Access-Control-Allow-Credentials: true');
}

set_error_handler('handle_error');

$_SESSION['lastseen'] = date('c');
$username = array_key_exists('username', $_SESSION) ? $_SESSION['username'] : null;
preg_match('/[^\w]/', $username) and error('invalid username');
$handout = @$_POST['handout'];
preg_match('/^\w[\w-]*\w$/', $handout) or error('invalid handout id');
// PCRE $ allows newline
preg_match('/[^\w-]/', $handout) and error('invalid handout id');
$student = json_decode($_POST['student']) or error('invalid student JSON');

// $handout must by now be sanitized for use as a filename
$configjson = file_get_contents("data/$handout.json") or error('unknown exercise id');
$config = json_decode($configjson) or error('error in server-side exercise configuration');

if (MAINTENANCE) {
  warning('exercise submission is down for maintenance, please come back later');
}

if (( ! $username) && defined('LOGIN_UNTIL') && (date('Y-m-d') <= LOGIN_UNTIL)) {
  warning('please log in to submit exercises');
}

// find the matching exercise...
foreach ($config->exercises as $exercise) {
  if ($exercise->id !== $student->id) { continue; }

  // ... score the exercise and exit
  $result = score_exercise($exercise, $student);

  $json = json_encode(array(
    'result' => $result
  ) + (array_key_exists('reveal', $_POST) || $result['correct'] ? array(
    'exercise' => $exercise
  ) : []));
  header('Content-Type: application/json');
  print $json;

  // done talking to the client
  header('Content-Length: ' . ob_get_length());
  ob_end_flush();

  // record submissions from logged-in users
  if ($username) {
    omnivore(COURSE, SEMESTER, $config, $username, $student, $result);
  }

  exit();
}
// ... no matching exercise
error('unknown exercise');

function handle_error($level, $message, $file, $line) {
  if (error_reporting() === 0) { return false; }
  $description = "Handout exercise submit error ($level)\n$message\nin $file on line $line";
  $context = print_r(array('session' => $_SESSION, 'post' => $_POST), true);
  @mail(OWNER, '[handx] Error report', "$description\n\n----\n\n$context");
  @log_error(array('message' => $message, 'file' => $file, 'line' => $line));
  return false;
}

function logical_and($a, $b) { return $a && $b; }
function get($key) { return function($arr) use($key) { return $arr[$key]; }; }
function not_false($val) { return $val !== false; }

function score_exercise($expect, $student) {
  if ($expect->category !== $student->category) { error('unexpected exercise category'); }
  if ($expect->node !== $student->node) { error('unexpected exercise'); }

  $parts = array_map('score_part', $expect->parts, $student->parts);
  return array(
    'correct' => array_reduce(array_map(get('correct'), $parts), 'logical_and', true),
    'parts' => $parts
  );
}

function score_part($expect, $student) {
  if ($expect->node !== $student->node) { error('unexpected exercise part'); }

  $choices = array_map('score_choice', $expect->choices, $student->choices);
  return array(
    'correct' => array_reduce($choices, 'logical_and', true)
  );
}

function score_choice($expect, $student) {
  if (property_exists($expect, 'node')) {
    if ($expect->node !== $student->node) { error('unexpected exercise question'); }
  } else {
    if (property_exists($student, 'node')) { error('unexpected exercise question'); }
  }

  if (property_exists($expect, 'regex')) {
    return preg_match($expect->regex . 'A', $student->input);
  } else {
    return $expect->expected == $student->input;
  }
}

// report a warning and exit
function warning($msg) {
  bail($msg);
}

// report an error and exit
function error($msg) {
  bail("$msg, please try reloading the page");
  @log_error(array('message' => $msg));
}

// return a failure message and exit
function bail($msg) {
  header('Content-Type: text/plain');
  http_response_code(400);
  print "$msg\n";
  header('Content-Length: ' . ob_get_length());
  ob_end_flush();
  exit();
}

// record responses and results in Omnivore
function omnivore($course, $semester, $config, $username, $student, $result) {
  $prefix = implode('/', array(
    $config->kind,
    $config->handout,
    $student->category,
    implode('-', array_filter(array($config->part, str_replace('/', '-', $student->id))))
  ));
  $millis = sprintf('%03d', gettimeofday()['usec'] / 1000);
  $now = gmdate("Y-m-d\TH:i:s\.")."${millis}Z";

  $records = array();
  foreach ($student->parts as $ii => $part) {
    $dir = "/$prefix-" . $part->node;
    array_push($records, array(
      'username' => $username, 'key' => "$dir/correct", 'ts' => $now,
      'value' => $result['parts'][$ii]['correct'],
    ));
    array_push($records, array(
      'username' => $username, 'key' => "$dir/answer", 'ts' => $now,
      'value' => implode("\n", array_filter(array_map('get_choice', $part->choices), 'not_false'))
    ));
  }
  $json = json_encode($records);

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

  $result = file_get_contents($url, false, stream_context_create($options));
  if ($result === false) {
    file_put_contents('log/lost-' . $config->handout . "-$username.json", "$json\n", FILE_APPEND | LOCK_EX);
  }
}

function get_choice($student) {
  if ($student->input === true) { return $student->node; }
  return $student->input;
}

function log_error($data) {
  global $username;
  $json = json_encode(array_merge($data, array('username' => $username)));
  file_put_contents('log/error-' . $_SERVER['REMOTE_ADDR'] . '.log', "$json\n", FILE_APPEND | LOCK_EX);
}
?>
