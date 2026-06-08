#!/bin/sh

if [ ! -f "/app/data/.env" ]; then
  READ_TOKEN="rs_read_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"
  WRITE_TOKEN="rs_write_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"
  
  echo "READYSTATE_READ_TOKEN=$READ_TOKEN" > /app/data/.env
  echo "READYSTATE_WRITE_TOKEN=$WRITE_TOKEN" >> /app/data/.env
  
  echo "==========================================================="
  echo "⚠️ FIRST LAUNCH: READYSTATE TOKENS GENERATED ⚠️"
  echo "Please save these tokens to configure your AI agents:"
  echo "READ TOKEN:  $READ_TOKEN"
  echo "WRITE TOKEN: $WRITE_TOKEN"
  echo "==========================================================="
fi

# Ensure database schema is up-to-date
npx prisma db push --skip-generate

exec "$@"
