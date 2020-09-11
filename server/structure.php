<?php

require 'course-setup.php';

$origin = $_SERVER['HTTP_ORIGIN'];
if (in_array($origin, $HANDOUT_ORIGINS)) {
  // allow CORS
  header("Access-Control-Allow-Origin: $origin");
}

function parse($json) {
  $configjson = file_get_contents($json.'.json');
  $config = json_decode($configjson);
  return $config;
}

function incl($config) {
  global $HANDOUT_TOC_KINDS;
  return in_array($config->kind, $HANDOUT_TOC_KINDS) && ! property_exists($config, 'noindex');
}

function entry($config) {
  return array(
    'handout' => implode('/', array_filter(array($config->kind, $config->handout, $config->part))),
    'structure' => $config->structure
  );
}

header('Content-Type: application/json');
$configs = array_map(function($name) { return substr($name, 0, -5); }, glob('data/*.json'));
natsort($configs);
print json_encode(array_map(entry, array_values(array_filter(array_map(parse, array_values($configs)), incl))));
?>
