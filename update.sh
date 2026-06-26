#!/bin/bash
set -e
cd /opt/acmc
echo "→ Pulling latest changes..."
git pull
echo "→ Rebuilding and restarting..."
docker-compose build --no-cache
docker-compose up -d
echo "✓ Update complete"
