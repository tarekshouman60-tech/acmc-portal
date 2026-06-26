#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║     ACMC Portal — Deployment         ║"
echo "╚══════════════════════════════════════╝"

# Config
APP_DIR="/opt/acmc"
REPO="https://github.com/YOUR_USERNAME/acmc-portal.git"  # update this

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! command -v docker-compose &> /dev/null; then
  echo "→ Installing Docker Compose..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# 2. Clone or pull
if [ -d "$APP_DIR/.git" ]; then
  echo "→ Pulling latest code..."
  cd $APP_DIR && git pull
else
  echo "→ Cloning repository..."
  mkdir -p $APP_DIR
  git clone $REPO $APP_DIR
  cd $APP_DIR
fi

cd $APP_DIR

# 3. Set secrets (prompt if not set)
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "→ Generated JWT_SECRET: $JWT_SECRET"
  echo "  (Save this! Add to your environment or .env file)"
fi

# 4. Create .env
cat > .env << ENVEOF
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=postgresql://acmc:acmc_pass@db:5432/acmc
ENVEOF

# 5. Build and start
echo "→ Building containers..."
docker-compose build --no-cache

echo "→ Starting services..."
docker-compose up -d

# 6. Wait for DB
echo "→ Waiting for database..."
sleep 8

echo ""
echo "✓ ACMC Portal is running!"
echo "  Frontend:  http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):3000"
echo "  Backend:   http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):8000"
echo "  Admin login: admin@acmc.eg / Admin@ACMC2024"
echo ""
echo "⚠️  IMPORTANT: Change the admin password immediately after first login."
