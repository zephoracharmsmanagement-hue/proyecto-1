#!/usr/bin/env bash
# Tipografías de los creativos (Google Fonts, licencia OFL). Se bajan, no se comitean.
set -e
D="$(dirname "$0")/fonts"; mkdir -p "$D"; cd "$D"
B=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -sSfLo 'PlayfairDisplay[wght].ttf'        "$B/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf"
curl -sSfLo 'PlayfairDisplay-Italic[wght].ttf' "$B/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf"
curl -sSfLo 'CormorantGaramond[wght].ttf'      "$B/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
curl -sSfLo 'Lato-Regular.ttf' "$B/lato/Lato-Regular.ttf"
curl -sSfLo 'Lato-Bold.ttf'    "$B/lato/Lato-Bold.ttf"
echo "Listo: $D"
