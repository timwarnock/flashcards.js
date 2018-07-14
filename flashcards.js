/*
*/


// max penalty time (in seconds) for each card
MAX_WAIT = 20;

// initial score for each card
INIT_SCORE = 3;

// set epsilon
// how often cards will be randomly selected
// 1 is 100%, random ordering of deck
// 0 is 0%, cards will appear strictly based on inverse-time sort
var EPSILON = 0.3; 



//GLOBALS

// this will be set by async json call
var FC_DATA = [
  {"key": "??", "answer": "42", "alt": "43?" },
  {"key": "Pi",   "answer": "3.141592653", "alt": "3" }
];

// audio cache
var FC_AUDIO = [false, false];
var FC_AUDIO_PROMPT = [false, false];

// the pointer into FC_DATA and FC_SCORE
var CURR_FC = 0;

// max number before re-shuffling
var HOW_MANY = 10;
var HOW_MANY_E = Math.floor(HOW_MANY * EPSILON);
HOW_MANY = HOW_MANY - HOW_MANY_E;

// the next indeces for CURR_FC
var NEXT_UP = [];

// TODO history indeces
var FC_HIST = [];

// save state for which side of the card is showing
var FC_STATUS = 'front';

// remember if the user flipped the current card
var FIRST_FLIP = true;




// shortcut to getElementById
function $(el) {
  return document.getElementById(el);
}




// stopwatch function (use system time)
var START_TS = new Date().getTime();
var startwatch = function() {
  START_TS = new Date().getTime();
};
var stopwatch = function() {
  return (new Date().getTime() - START_TS)/1000;
};




/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
var shuffle = function(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}




// fetch JSON object from URL
var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        var resjson = xhr.response;
        if (typeof resjson == "string") {
          resjson = JSON.parse(xhr.response);
        }
        callback(null, resjson);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};

// scores will be initialized from localStorage
var FC_SCORE = [0,0];
var FC_NAME;
Storage.prototype.setObj = function(key, obj) {
  return this.setItem(key, JSON.stringify(obj))
}
Storage.prototype.getObj = function(key) {
  return JSON.parse(this.getItem(key))
}
function initScores(fcname) {
  FC_NAME = fcname;
  FC_SCORE = localStorage.getObj(fcname);
  if ( !(FC_SCORE && FC_SCORE.length == FC_DATA.length)) {
    clearScores();
  }
}
function clearScores(base_score) {
  if (typeof base_score === 'undefined') { base_score = INIT_SCORE; }
  NEXT_UP = [];
  FC_SCORE = Array.apply(null, Array(FC_DATA.length)).map(Number.prototype.valueOf,base_score);
}
function getScore(index) {
  return FC_SCORE[index];
}
function setScore(index,score) {
  FC_SCORE[index] = score;
  localStorage.setObj(FC_NAME,FC_SCORE);
}


// return the current flashcard data
function _currFlashcard() {
  return FC_DATA[CURR_FC];
};

// fetch the next flashcard, and set the internal pointer
function _nextFlashcard() {
  //CURR_FC = (CURR_FC + 1) % FC_DATA.length;
  var cand = NEXT_UP.shift();
  if (cand == null) {
    //TODO testable MAB functions, reshuffle?
    var score_index = reverse_scores_index();
    var how_many = HOW_MANY < score_index.length ? HOW_MANY : score_index.length;
    NEXT_UP = score_index.slice(0,how_many);
    var remaining = score_index.slice(how_many.length);
    if (remaining.length > 0) {
      shuffle(remaining);
      NEXT_UP = NEXT_UP.concat(remaining.slice(0,HOW_MANY_E));
    }
    shuffle(NEXT_UP);
    cand = NEXT_UP.shift();
  }
  CURR_FC = cand;
  return _currFlashcard();
};

// internal, return reverse-sorted array of indexes (from flashcard scores)
function reverse_scores_index() {
  var toSort = FC_SCORE.slice();
  for (var i = 0; i < toSort.length; i++) {
    toSort[i] = [toSort[i], i];
  }
  toSort.sort(function(left, right) {
    return left[0] > right[0] ? -1 : 1;
  });
  toSort.sortIndices = [];
  for (var j = 0; j < toSort.length; j++) {
    toSort.sortIndices.push(toSort[j][1]);
    toSort[j] = toSort[j][0];
  }
  return toSort.sortIndices;
};

// internal, set the DOM based on the current selected flashcard
function _setFlashcard() {
  var fc = _currFlashcard();
  fcstat( 'card ' + (CURR_FC+1) + ' of ' + FC_SCORE.length 
         + ' (' + FC_SCORE[CURR_FC].toFixed(2) + 's avg)');
  console.log('card ' + (CURR_FC+1) + ' = ' + FC_SCORE[CURR_FC]);
  var fcf = '<div class="flashcard-prompt">'
  fcf += fc.key + '</div>';
  $('flashcard-front').innerHTML = fcf;
 // $('flashcard-content-wrapper').style.backgroundImage = 'url("images/danger/imconfused.jpg")';
  var fcb = '<div class="flashcard-full-answer">' + fc.answer + '</div>';
  fcb += '<div class="flashcard-full-key">' + fc.key + '</div>';
  fcb += '<div class="flashcard-full-alt">' + fc.alt + '</div>';
  $('flashcard-back').innerHTML = fcb;
};
function _unsetFlashcard() {
  $('flashcard-front').innerHTML = '';
  $('flashcard-back').innerHTML = '';
}


// display the front of the flashcard
function showFrontFlashcard() {
  FC_STATUS = 'front';
  $('flashcard').classList.remove('back');
  $('flashcard').classList.add('front');
  var fcf = $('flashcard-front');
  var fcb = $('flashcard-back');
  fcf.parentNode.insertBefore(fcf,fcb);
  fcf.style.visibility = "visible";
  fcb.style.visibility = "hidden";
  fcf.style.opacity = "1";
  fcb.style.opacity = "0";
  _playAudioPrompt();
};

// display the back of the flashcard
// start timer if it's the first flip
function showBackFlashcard() {
  FC_STATUS = 'back';
  if (FIRST_FLIP) {
    startwatch();
    FIRST_FLIP = false;
    $('flashcard-okay').innerHTML = 'next';
    $('flashcard-okay').classList.add('next-flipped')
  }
  $('flashcard').classList.remove('front');
  $('flashcard').classList.add('back');
  var fcf = $('flashcard-front');
  var fcb = $('flashcard-back');
  fcf.parentNode.insertBefore(fcb,fcf);
  fcf.style.visibility = "hidden";
  fcb.style.visibility = "visible";
  fcf.style.opacity = "0";
  fcb.style.opacity = "1";
  _playAudio();
};

// called when the user advances to the next card
function showNextFlashcard() {
  if (FIRST_FLIP) {
    //user is skipping this card (no score change, for now)
  } else {
    var wait_s = stopwatch();
    wait_s = wait_s < MAX_WAIT ? wait_s : MAX_WAIT;
    var oldscore = getScore(CURR_FC)
    setScore(CURR_FC, (oldscore*3 + wait_s)/4 );
  }
  FIRST_FLIP = true;
  $('flashcard-okay').innerHTML = 'flip';
  $('flashcard-okay').classList.remove('next-flipped')
  _stopAudio();
  _nextFlashcard();
  _setFlashcard();
  showFrontFlashcard();
};

// flip/next
function flipNext() {
  if (FIRST_FLIP) {
    showBackFlashcard();
  } else {
  	showNextFlashcard();
  }
}


// flip card from front to back
function toggleFlashcard() {
  if (FC_STATUS === 'front') {
    return showBackFlashcard();
  } else {
    return showFrontFlashcard();
  }
};

// set the status message
function fcstat(msg) {
  document.getElementById('fc-status').innerHTML = msg;
};



// load the flashcard data from JSON
function loadDeck(url, preload) {
  preload = typeof preload !== 'undefined' ? preload : false;
  _showModal();
  pauseLoad();
  fcstat('loading');
  getJSON(url, function(err, data) {
    if (err !== null) {
      console.log('Something went wrong: ' + err);
      quitDeck();
    } else {
      FC_DATA = data;
      initScores(url);
      if (preload) {
        FC_AUDIO = preloadAudio(FC_DATA);
        FC_AUDIO_PROMPT = preloadAudioP(FC_DATA);
      } else {
        FC_AUDIO = new Array(data.length).fill(false);
        FC_AUDIO_PROMPT = new Array(data.length).fill(false);
      }
      CURR_FC = 0;
      FIRST_FLIP = true;
      NEXT_UP = [];
      _nextFlashcard();
      _setFlashcard();
      showFrontFlashcard();
      loadedAudio();
    }
  });
};

// show flashcard-modal
function _showModal() {
  $('flashcard-modal').style.visibility = "visible";
}
function _closeModal() {
  $('flashcard-modal').style.visibility = "hidden";
}

// quit the flashcards
function quitDeck() {
  unpause();
  _stopAudio();
  _unsetFlashcard();
  $('flashcard-okay').innerHTML = 'flip';
  $('flashcard-okay').classList.remove('next-flipped')
  _closeModal();
}

// pause the flashcards
function pause() {
  var paused = '<div id="flashcard-stats">';
  paused += '<div id="flashcard-pause-quit" class="hand" onclick="quitDeck();">× quit</div>';
  paused += getStats();
  paused += '<div id="flashcard-pause-reset" class="hand" onclick="showResets();">reset scores</div>';
  paused += '<div id="flashcard-pause-reset2" class="hand hidden" onclick="clearScores(INIT_SCORE);pause();">- depth first (3 seconds)</div>';
  paused += '<div id="flashcard-pause-reset10" class="hand hidden" onclick="clearScores(MAX_WAIT);pause();">- breadth first (20 seconds)</div>';
  paused += '<div id="flashcard-pause-resume" class="hand" onclick="unpause();">resume</div>';
  paused += '</div>';
  $('flashcard-pause-modal').style.visibility = "visible";
  $('flashcard-pause-modal').style.opacity = "1";
  $('flashcard-pause-modal').innerHTML = paused;
}
function showResets() {
  $('flashcard-pause-reset2').classList.remove('hidden');
  $('flashcard-pause-reset10').classList.remove('hidden');
}
function pauseLoad() {
  var paused = '<div id="flashcard-stats">loading...</div>';
  $('flashcard-pause-modal').style.visibility = "visible";
  $('flashcard-pause-modal').style.opacity = "1";
  $('flashcard-pause-modal').innerHTML = paused;
}
function unpause() {
  $('flashcard-pause-modal').style.visibility = "hidden";
  $('flashcard-pause-modal').style.opacity = "0";
}

// print stats
function getStats() {
  var stats = '';
  stats += FC_DATA.length + ' cards, ';
  var avg = 0;
  for (var i=0; i < FC_DATA.length; i++) {
    avg += FC_SCORE[i];
  }
  stats += (avg/FC_DATA.length).toFixed(2) + 's average';
  return stats;
}





//preload any audio files
var audio_count = 0;
var audio_ready = 0;
function preloadAudio(data) {
  var audiof = new Array();
  audio_count = 0;
  audio_ready = 0;
  for (var i=0; i<data.length; i++) {
    audiof[i] = false;
    if (data[i].audio) {
      audiof[i] = new Audio();
      audiof[i].addEventListener('canplaythrough', loadedAudio, false); 
      audiof[i].src = 'audio/' + data[i].audio;
      audio_count++;
    }
  }
  return audiof;
};
function preloadAudioP(data) {
  var audiof = new Array();
  for (var i=0; i<data.length; i++) {
    audiof[i] = false;
    if (data[i].audio_prompt) {
      audiof[i] = new Audio();
      audiof[i].addEventListener('canplaythrough', loadedAudio, false); 
      audiof[i].src = 'audio/' + data[i].audio_prompt;
      audio_count++;
    }
  }
  return audiof;
};
function loadedAudio() {
  audio_ready++;
  if (audio_ready >= audio_count) {
    unpause();
  } else {
    $('flashcard-stats').innerHTML = 'loading ' + audio_ready + ' of ' + audio_count
    + '<div id="force-start" class="hand" onclick="unpause();">force start</div>';
  }
};

// attempt to play the current cards audio
function _playAudio() {
  if (FC_AUDIO[CURR_FC]) {
    var player = $('flashcard-audio');
    player.src = FC_AUDIO[CURR_FC].src
    player.play();
  } else if ('audio' in FC_DATA[CURR_FC]) {
    console.log('lazy loading ' + FC_DATA[CURR_FC].audio);
    FC_AUDIO[CURR_FC] = new Audio();
    FC_AUDIO[CURR_FC].addEventListener('canplaythrough', _playAudio, false);
    FC_AUDIO[CURR_FC].src = 'audio/' + FC_DATA[CURR_FC].audio;
  }
};
function _playAudioPrompt() {
  if (FC_AUDIO_PROMPT[CURR_FC]) {
    var player = $('flashcard-audio');
    player.src = FC_AUDIO_PROMPT[CURR_FC].src
    player.play();
  } else if ('audio_prompt' in FC_DATA[CURR_FC]) {
    console.log('lazy loading ' + FC_DATA[CURR_FC].audio_prompt);
    FC_AUDIO_PROMPT[CURR_FC] = new Audio();
    FC_AUDIO_PROMPT[CURR_FC].addEventListener('canplaythrough', _playAudioPrompt, false);
    FC_AUDIO_PROMPT[CURR_FC].src = 'audio/' + FC_DATA[CURR_FC].audio_prompt;
  }
};
function _stopAudio() {
  var player = $('flashcard-audio');
  player.pause();
};


// keyboard intercepts - EXPERIMENTAL
// TODO stop propagation
// TODO only intercept when IS_ACTIVE (or whatever, that is, unpaused and audio loaded)
document.onkeydown = function(evt) {
  evt = evt || window.event;
  if (evt.keyCode == 32) {
    console.log('space = pause');
    if ($('flashcard-pause-modal').style.visibility == "visible") {
      unpause();
    } else {
      pause();
    }
  }
  if (evt.keyCode == 13) {
    console.log('enter = flip/next');
    flipNext();
  }
  if (evt.keyCode == 70) {
    console.log('f = toggle');
    toggleFlashcard();
  }
  if (evt.keyCode == 83) {
    console.log('s = skip');
    showNextFlashcard();
  }
  if (evt.keyCode == 88) {
    console.log('x - quit');
    pause();
    quitDeck();
  }
  
};


// swipe right - EXPERIMENTAL
document.addEventListener('touchstart', handleTouchStart, false);        
document.addEventListener('touchmove', handleTouchMove, false);

var xDown = null;                                                        
var yDown = null;                                                        

function handleTouchStart(evt) {
    console.log('touch start');
    xDown = evt.touches[0].clientX;
    yDown = evt.touches[0].clientY;
};

function handleTouchMove(evt) {
    if ( ! xDown || ! yDown ) {
        return;
    }

    var xUp = evt.touches[0].clientX;                                    
    var yUp = evt.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/*most significant*/
        if ( xDiff > 0 ) {
            /* right swipe */ 
            flipNext();
        } else {
            /* left swipe */
        }                       
    } else {
        if ( yDiff > 0 ) {
            /* up swipe */ 
        } else { 
            /* down swipe */
        }                                                                 
    }
    /* reset values */
    xDown = null;
    yDown = null;                                             
};

