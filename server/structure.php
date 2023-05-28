<?php

require 'course-setup.php';

$origin = $_SERVER['HTTP_ORIGIN'];
if (in_array($origin, $HANDOUT_ORIGINS)) {
  // allow CORS
  header("Access-Control-Allow-Origin: $origin");
}

function load_handout($handout_id) {
  return json_decode(file_get_contents('data/'.$handout_id.'.json'));
}

function collect_handouts($handout_ids) {
  $handouts = array_map(load_handout, array_values($handout_ids));
  $array_of_array_of_handouts = array_map(function($config) { 
    return collect_handouts($config->handoutsToIndex); 
  }, $handouts);
  foreach ($array_of_array_of_handouts as $array_of_handouts) {
    foreach ($array_of_handouts as $config) {
      array_push($handouts, $config);
    }
  }
  return $handouts;
}

function entry($config) {
  return array(
    'handout' => implode('/', array_filter(array($config->kind, $config->handout, $config->part))),
    'structure' => $config->structure
  );
}

header('Content-Type: application/json');

$configs = collect_handouts($HANDOUT_TOC_ROOTS);
$configs = array_values(array_filter($configs, function($config) { return ! property_exists($config, 'noindex'); 
}));
//natsort($configs); // rely on the in-order traversal of handoutsToIndex
print json_encode(array_map(entry, $configs));
?>
