#!/bin/bash
# Génère une version Firefox de l'extension dans le dossier firefox/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIREFOX_DIR="$SCRIPT_DIR/firefox"

# Nettoyer et créer le dossier
rm -rf "$FIREFOX_DIR"
mkdir -p "$FIREFOX_DIR"

# Copier tous les fichiers
cp "$SCRIPT_DIR"/*.js "$FIREFOX_DIR/"
cp "$SCRIPT_DIR"/*.html "$FIREFOX_DIR/"
cp "$SCRIPT_DIR"/*.css "$FIREFOX_DIR/"
cp "$SCRIPT_DIR"/*.png "$FIREFOX_DIR/"
cp -r "$SCRIPT_DIR/images" "$FIREFOX_DIR/" 2>/dev/null

# Générer le manifest Firefox : remplacer service_worker par scripts
sed 's/"service_worker": "background.js"/"scripts": ["background.js"]/' \
  "$SCRIPT_DIR/manifest.json" > "$FIREFOX_DIR/manifest.json"

echo "✅ Version Firefox générée dans: $FIREFOX_DIR"
echo "   → Charger dans Firefox via about:debugging#/runtime/this-firefox"
