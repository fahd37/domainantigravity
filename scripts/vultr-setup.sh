#!/bin/bash
set -e

APP_DIR="/var/www/domainhunter"
REPO="https://github.com/fahd37/domainantigravity.git"

echo "================================================"
echo "🚀 DomainHunter Vultr VPS Setup"
echo "================================================"

# Update system
echo "📦 Updating system..."
apt-get update -y && apt-get upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node version
echo "✅ Node: $(node --version)"
echo "✅ NPM: $(npm --version)"

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt-get install -y nginx

# Install other tools
apt-get install -y git curl wget unzip

echo "✅ All dependencies installed"

# Clone repository
echo "📥 Cloning repository..."
rm -rf $APP_DIR
git clone $REPO $APP_DIR
cd $APP_DIR

# Create .env file
echo "📝 Creating environment file..."
cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://postgres.gusyuhsawwtcfdnnxgre:winners05@wydad37@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.gusyuhsawwtcfdnnxgre:winners05@wydad37@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
ENCRYPTION_KEY="12345678901234567890123456789012"
CRON_SECRET="change-me-random-string-32chars"
NEXT_PUBLIC_CRON_SECRET="change-me-random-string-32chars"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="changeme"
NODE_ENV="production"
USE_MOCK_DATA="false"
ENVEOF

echo "✅ Environment file created"

# Install dependencies
echo "📦 Installing npm packages..."
npm install

# Generate Prisma client
echo "🔨 Generating Prisma client..."
npx prisma generate

# Build app
echo "🔨 Building Next.js app..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Seed database
echo "🌱 Seeding database..."
npx prisma db seed || echo "Seed already ran, skipping"

# Configure Nginx
echo "⚙️ Configuring Nginx..."
cat > /etc/nginx/sites-available/domainhunter << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/domainhunter /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx && systemctl enable nginx
echo "✅ Nginx configured"

# Create PM2 ecosystem file
echo "⚙️ Creating PM2 config..."
cat > $APP_DIR/ecosystem.config.js << 'PM2EOF'
module.exports = {
  apps: [{
    name: 'domainhunter',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/var/www/domainhunter',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '800M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/domainhunter-error.log',
    out_file: '/var/log/domainhunter-out.log'
  }]
}
PM2EOF

# Start app with PM2
echo "🚀 Starting app..."
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 to start on reboot
pm2 startup systemd -u root --hp /root | tail -1 | bash

# Setup cron jobs
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 */6 * * * curl -s http://localhost:3000/api/cron/scan -H 'x-cron-secret: change-me-random-string-32chars' >> /var/log/cron-scan.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "*/30 * * * * curl -s http://localhost:3000/api/cron/score -H 'x-cron-secret: change-me-random-string-32chars' >> /var/log/cron-score.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -s http://localhost:3000/api/cron/queue -H 'x-cron-secret: change-me-random-string-32chars' >> /var/log/cron-queue.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * 0 curl -s http://localhost:3000/api/cron/update-market-data -H 'x-cron-secret: change-me-random-string-32chars' >> /var/log/cron-market.log 2>&1") | crontab -

echo "✅ Cron jobs configured"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "================================================"
echo "✅ SETUP COMPLETE!"
echo "================================================"
echo "🌐 App URL: http://$SERVER_IP"
echo "🔑 Login: admin@example.com"
echo "🔑 Password: changeme"
echo "📊 PM2 Status: pm2 status"
echo "📋 App Logs: pm2 logs domainhunter"
echo "🔄 Update app: bash /var/www/domainhunter/scripts/update.sh"
echo "================================================"
