#!/bin/sh
set -e

baseline_migrations() {
  npx prisma migrate resolve --rolled-back 20260730192506_init >/dev/null 2>&1 || true
  npx prisma migrate resolve --applied 20260730192506_init >/dev/null 2>&1 || true
}

start() {
  if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set; refusing to start." >&2
    exit 1
  fi
  echo "Applying Prisma migrations..."
  baseline_migrations
  npx prisma migrate deploy
  exec node src/index.js
}

if [ -n "$INFISICAL_CLIENT_ID" ] && [ -n "$INFISICAL_CLIENT_SECRET" ]; then
  echo "Authenticating with Infisical..."

  INFISICAL_TOKEN="$(infisical login \
    --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --silent --plain)"
  export INFISICAL_TOKEN

  if [ -z "$INFISICAL_TOKEN" ]; then
    echo "Infisical login returned an empty token; refusing to start." >&2
    exit 1
  fi

  echo "Starting with secrets from Infisical (env=${INFISICAL_ENV:-prod})."
  exec infisical run \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env="${INFISICAL_ENV:-prod}" \
    --path="${INFISICAL_PATH:-/}" \
    -- sh -c 'npx prisma migrate resolve --rolled-back 20260730192506_init >/dev/null 2>&1 || true; npx prisma migrate resolve --applied 20260730192506_init >/dev/null 2>&1 || true; npx prisma migrate deploy && exec node src/index.js'
fi

echo "INFISICAL_CLIENT_ID/SECRET not set; starting with the container environment."
start
