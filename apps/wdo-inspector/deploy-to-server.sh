#!/bin/bash

# Deploy WDO Inspector to grund-server
# This script builds the app and deploys it to your remote server

set -e

# Configuration
SERVER_HOST=${SERVER_HOST:-"your-grund-server.com"}
SERVER_USER=${SERVER_USER:-"root"}
SERVER_PORT=${SERVER_PORT:-"22"}
DEPLOY_PATH="/opt/wdo-inspector"
DOMAIN=${DOMAIN:-"wdo.yourdomain.com"}

echo "🚀 Deploying WDO Inspector to $SERVER_HOST"

# Step 1: Build the app locally
echo "📦 Building application..."
bun install --frozen-lockfile
bun run build

# Step 2: Create deployment archive
echo "📁 Creating deployment archive..."
tar -czf wdo-inspector-dist.tar.gz \
    dist/ \
    nginx.conf \
    docker-compose.yml \
    Dockerfile

# Step 3: Copy files to server
echo "📤 Copying files to server..."
scp -P $SERVER_PORT wdo-inspector-dist.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

# Step 4: Deploy on server
echo "🚢 Deploying on server..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << 'EOF'
    set -e

    # Create deployment directory
    mkdir -p /opt/wdo-inspector
    cd /opt/wdo-inspector

    # Extract files
    tar -xzf /tmp/wdo-inspector-dist.tar.gz
    rm /tmp/wdo-inspector-dist.tar.gz

    # Build and start container
    docker-compose down || true
    docker-compose build
    docker-compose up -d

    # Wait for service
    sleep 5

    # Check health
    if curl -f http://localhost:3002/health > /dev/null 2>&1; then
        echo "✅ Service is healthy!"
    else
        echo "⚠️ Health check failed, check logs with: docker-compose logs"
    fi

    # Clean up
    docker image prune -f
EOF

# Clean up local archive
rm wdo-inspector-dist.tar.gz

echo "✨ Deployment complete!"
echo "🔗 Application should be accessible at: https://$DOMAIN"
echo "📝 Note: Make sure Traefik/nginx is configured on your server"
