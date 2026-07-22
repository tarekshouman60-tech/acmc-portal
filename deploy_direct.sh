#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║     ACMC Portal — Deployment         ║"
echo "╚══════════════════════════════════════╝"

APP_DIR="/opt/acmc"

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# 2. Install Docker Compose plugin
if ! docker compose version &> /dev/null 2>&1; then
  echo "→ Installing Docker Compose..."
  apt-get update -qq
  apt-get install -y docker-compose-plugin
fi

# 3. Clone repo
# Set GITHUB_TOKEN in the environment before running this script if the repo is private,
# e.g. `GITHUB_TOKEN=ghp_xxx ./deploy_direct.sh`. Never hardcode tokens in this file.
echo "→ Cloning repository..."
rm -rf $APP_DIR
if [ -n "$GITHUB_TOKEN" ]; then
  git clone "https://tarekshouman60-tech:${GITHUB_TOKEN}@github.com/tarekshouman60-tech/acmc-portal.git" $APP_DIR
else
  git clone https://github.com/tarekshouman60-tech/acmc-portal.git $APP_DIR
fi

cd $APP_DIR

# 4. Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# 5. Create .env
cat > .env << ENVEOF
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=postgresql://acmc:acmc_pass@db:5432/acmc
ENVEOF

# 6. Build and start
echo "→ Building containers (this takes 3-5 minutes)..."
docker compose build --no-cache

echo "→ Starting services..."
docker compose up -d

echo "→ Waiting for database to initialize..."
sleep 12

echo ""
echo "✓ ACMC Portal is running!"
echo "  Portal:  http://165.227.173.18:3000"
echo "  API:     http://165.227.173.18:8000"
echo ""
echo "  Admin login: admin@acmc.eg"
echo "  Password:    Admin@ACMC2024"
echo ""
echo "  JWT_SECRET (save this): ${JWT_SECRET}"
echo "⚠️  Change admin password immediately after first login."
