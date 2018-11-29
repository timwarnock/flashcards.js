#!/bin/bash
#
#

DATA_FILE=$1
AUDIO_DIR=$2


#
# verify parameters
if [ $# -ne 2 ]; then
  echo "Usage: $0 data.csv audio-directory"
  exit 1
elif [ ! -r $1 ]; then
  echo "Cannot find $1"
  exit 1
elif [ ! -d audio/$2 ]; then
  mkdir audio/$2
fi



#
function fetch() {
  HEADERS="-U=Mozilla"
  QUERY=`python -c "import urllib, sys; print urllib.quote(sys.argv[1])" "$1"`
  OUTFILE=$2
  wget -O "$OUTFILE" $HEADERS 'https://code.responsivevoice.org/getvoice.php?t='$QUERY'&tl=zh-TW&sv=g1&vn=&pitch=0.5&rate=0.44&vol=1'
}



#
# check if DATA_FILE exists, add audio column
if [ -r "$DATA_FILE" ]; then
  dos2unix $DATA_FILE
  head -1 $DATA_FILE | grep audio
  if [ $? -eq 0 ]; then
    echo "audio already exists in $DATA_FILE, skipping"
  else
    echo `head -1 $DATA_FILE`",audio" > _TEMP
    audio_c=1
    sed 1d $DATA_FILE | while read -r line ; do
      arrIN=(${line//,/ })
      key=${arrIN[0]}
      echo "$line,$AUDIO_DIR/$audio_c.mp3" >> _TEMP
      ((audio_c++))
    done
    mv _TEMP $DATA_FILE
  fi
fi



#
# check if audio files exist, fetch if not
if [ -r "$DATA_FILE" ]; then
  csvtool namedcol key,audio $DATA_FILE | while read -r line ; do
    key=`echo $line | awk -F, '{ print $1 }'`
    audio=`echo $line | awk -F, '{ print $2 }'`
    if [ "$audio" == "audio" ]; then
      echo "this file has audio"
    elif [ -r "audio/$audio" ]; then
      echo "$audio exists"
    else
      echo "fetch $key into audio/$audio"
      fetch "$key" "audio/$audio"
    fi
  done
fi


