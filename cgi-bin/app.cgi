#!/bin/sh
exec /virtual/pcm/.nvm/versions/node/v24.18.0/bin/node --max-old-space-size=256 "$(dirname "$0")/app.cjs"
