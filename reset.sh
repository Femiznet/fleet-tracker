#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

echo "🔄 Starting full database and migration reset..."

# 1. Load environment variables from .env.local file
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo "✅ Loaded environment variables from .env.local"
else
  echo "❌ Error: .env.local file not found!"
  exit 1
fi

# 2. Check if DATABASE_URL is defined
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL is not set in your .env.local file!"
  exit 1
fi

# 3. Wipe the local Drizzle migration files
echo "🗑️  Deleting local Drizzle migration artifacts..."
rm -rf drizzle/

# 4. Clear the PostgreSQL database schema
echo "💥 Wiping the PostgreSQL public schema..."
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"

# 5. Generate and apply a clean, fresh Drizzle state
echo "🏗️  Generating fresh Drizzle migration snapshots and 🧩 Appending custom database functions..."
pnpm db:generate

echo "🚀 Applying migrations to the fresh database..."
pnpm db:migrate

echo "🎉 Database and migrations have been reset successfully!"
