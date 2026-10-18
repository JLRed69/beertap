#!/usr/bin/env bash
# Compila la interfaz web de la estación para el WebView 83 del A17mini.
set -e
A=android/app/src/main/assets/www
rm -rf "$A" && mkdir -p "$A"
for f in native-bridge live-glass live-bus live-shared live-station station-main; do
  npx -y esbuild@0.21.5 "web-src/$f.jsx" --format=iife --target=chrome83 --minify --outfile="$A/$f.js"
done
cp web-src/live-styles.css "$A/"
cp web-src/station.html "$A/index.html"
curl -fsSL https://unpkg.com/react@18.3.1/umd/react.production.min.js -o "$A/react.js"
curl -fsSL https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js -o "$A/react-dom.js"
curl -fsSL https://unpkg.com/mqtt@4.3.7/dist/mqtt.min.js -o "$A/mqtt.js"
curl -fsSL https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js -o "$A/jsQR.js"
ls -la "$A"
