#!/bin/bash

handout=${1:?Missing handout}
incoming=${2:?Missing incoming tar}
www=${3:?Missing www destination path}
data=${4:?Missing data destination path}

dest="$www/$handout"

if [ ! -d "$dest" ]; then
  echo "skipping $handout: $dest does not exist"
  exit
fi
if [ $handout == home ]; then
  dest=$www
fi

seps=${handout//[!\/]}
let depth=${#seps}+1
tar xf $incoming --directory=$dest --strip-components=$depth --anchored $handout/

tar xf $incoming --directory=$data --strip-components=1 --anchored --wildcards ".handx/${handout//\//-}*"
