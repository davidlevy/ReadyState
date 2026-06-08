#!/bin/sh

if [ ! -f "/app/data/.env" ]; then
  READ_TOKEN="rs_read_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"
  WRITE_TOKEN="rs_write_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"
  
  echo "READYSTATE_READ_TOKEN=$READ_TOKEN" > /app/data/.env
  echo "READYSTATE_WRITE_TOKEN=$WRITE_TOKEN" >> /app/data/.env
  
  echo "===========================================================" >&2
  echo "FIRST LAUNCH: READYSTATE TOKENS GENERATED" >&2
  echo "Please save these tokens to configure your AI agents:" >&2
  echo "READ TOKEN:  $READ_TOKEN" >&2
  echo "WRITE TOKEN: $WRITE_TOKEN" >&2
  echo "===========================================================" >&2
fi

# Ensure database schema is up-to-date
npx prisma db push --skip-generate > /dev/null 2>&1

exec "$@"
