#!/usr/bin/env bash
# Corre las tres baterías contra una copia servida del sitio.
#
#   ./pruebas/correr.sh              levanta un servidor local y prueba contra él
#   URL=https://zephoracharms.com ./pruebas/correr.sh   prueba contra producción
#
# Se puede llamar desde cualquier directorio.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"
PUERTO="${PUERTO:-8899}"
PROPIO=0

if [ -z "${URL:-}" ]; then
  # Sin URL, servimos la raíz del repo nosotros mismos y la apagamos al salir.
  python3 -m http.server "$PUERTO" --directory "$RAIZ" >/dev/null 2>&1 &
  SERVIDOR=$!
  PROPIO=1
  export URL="http://localhost:$PUERTO"
  trap 'kill $SERVIDOR 2>/dev/null' EXIT
  for _ in $(seq 1 25); do
    curl -sf -o /dev/null "$URL/index.html" && break
    sleep 0.2
  done
fi

echo "Probando contra $URL"
[ "$PROPIO" = 1 ] && echo "(servidor local levantado para esta corrida)"
echo

if [ ! -d "$AQUI/node_modules" ]; then
  echo "Instalando Playwright…"
  (cd "$AQUI" && npm install --silent) || { echo "No se pudo instalar Playwright"; exit 1; }
  echo
fi

ROJAS=""
for BATERIA in regresion stock dudas precios checkout; do
  echo "──────── $BATERIA ────────"
  # Los scripts imprimen "✗ FALLA" en vez de salir con código de error, así que
  # se revisa la salida. Se guarda para no correr cada batería dos veces.
  SALIDA="$(node "$AQUI/$BATERIA.js" 2>&1)" || ROJAS="$ROJAS  $BATERIA: terminó con error"$'\n'
  echo "$SALIDA"
  ROJAS="$ROJAS$(echo "$SALIDA" | grep '✗' | sed 's/^/  /')"
  echo
done

if [ -n "$(echo "$ROJAS" | tr -d '[:space:]')" ]; then
  echo "Comprobaciones en rojo:"
  echo "$ROJAS"
  exit 1
fi
echo "Todo en verde."
