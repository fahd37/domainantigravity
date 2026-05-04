#!/bin/bash
set -e

APP_DIR="/var/www/domainhunter"
echo "🔄 Updating DomainHunter..."
cd $APP_DIR
git pull origin main
npm install
npx prisma generate
npm run build
npx prisma migrate deploy
pm2 restart domainhunter
echo "✅ Update complete!"
pm2 status
