QUnit.test( "hello test", function( assert ) {
  assert.ok( 1 == "1", "Passed!" );
});


QUnit.test( "flashcard test", function( assert ) {
  assert.ok( FC_DATA.length == 2, "Passed!" );
  assert.equal( FC_SCORE.length, 2);
});

