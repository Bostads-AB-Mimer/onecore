#!/usr/bin/env bash
# Builds dist/mimer-theme.jar. The only place the JAR is put together: the Dockerfile runs this too.
#
# Generates the files theme/ does not commit (git-ignored, so `pnpm preview` mounts a complete theme):
#   - js/normalize-login-id.global.js: src/ bundled with the personnummer library
#   - fonts/: the Bison and Graphik files from internal-portal, so both apps ship the same fonts
#   - messages_en.properties: a copy of the Swedish texts, so our own keys never show as raw key
#     names when the realm has internationalization off (Keycloak then resolves English)
set -euo pipefail
cd "$(dirname "$0")/.."

LOGIN=theme/mimer/login
FONTS=../internal-portal/frontend/assets

mkdir -p "$LOGIN/resources/js" "$LOGIN/resources/fonts"
tsup src/normalize-login-id.ts --format iife --target es2017 --silent \
  --out-dir "$LOGIN/resources/js"
cp "$FONTS/Bison-Bold.woff2" "$FONTS/Graphik-Bold.woff2" "$FONTS/Graphik-Regular.woff2" "$LOGIN/resources/fonts/"
cp "$LOGIN/messages/messages_sv.properties" "$LOGIN/messages/messages_en.properties"

# Reproducible JAR: fixed timestamps, sorted entries and no extra file attributes, so the
# image layer only changes when the theme does
rm -rf dist && mkdir -p dist/jar
cp -R META-INF theme dist/jar/
export TZ=UTC
find dist/jar -exec touch -t 198001010000 {} +
(cd dist/jar && find META-INF theme | LC_ALL=C sort | zip -qX -@ ../mimer-theme.jar)
touch -t 198001010000 dist/mimer-theme.jar
rm -rf dist/jar
