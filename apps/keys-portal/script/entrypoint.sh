#!/bin/sh
set -eu

node script/inject-env.js /usr/share/nginx/html/index.html

exec "$@"
