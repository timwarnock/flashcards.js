<?
################################################################################
##
##  prototype JSON service for flashcards
##
################################################################################
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');  

$CSV = $_REQUEST['input'];
// check if csv exists here or in data directory
if (!file_exists($CSV)) {
  $CSV = "data/$CSV";
}
if (!file_exists($CSV)) {
  // can't find csv, give up
  http_response_code(404);
  die();
}

$FC = array();

if (($handle = fopen($CSV, "r")) !== FALSE) {
  $headers = fgetcsv($handle, 2000, ",");
  while (($data = fgetcsv($handle, 2000, ",", '"')) !== FALSE) {
    if (count($data) == count($headers))
      $FC[] = array_combine($headers, $data);
  }
  fclose($handle);
}

print( json_encode($FC) );


?>
