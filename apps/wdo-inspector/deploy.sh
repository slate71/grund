#!/bin/bash

# WDO Inspector Deployment Script
# Usage: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}
IMAGE_NAME="wdo-inspector"
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")

echo "🚀 Deploying WDO Inspector ($ENVIRONMENT)"
echo "📦 Building Docker image: $IMAGE_NAME:$IMAGE_TAG"

# Build the Docker image
docker build -t $IMAGE_NAME:$IMAGE_TAG .

if [ -n "$DOCKER_REGISTRY" ]; then
    # Tag and push to registry if configured
    docker tag $IMAGE_NAME:$IMAGE_TAG $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG
    docker tag $IMAGE_NAME:$IMAGE_TAG $DOCKER_REGISTRY/$IMAGE_NAME:latest

    echo "📤 Pushing to registry: $DOCKER_REGISTRY"
    docker push $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG
    docker push $DOCKER_REGISTRY/$IMAGE_NAME:latest
fi

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🌐 Deploying to production..."

    # Stop existing container
    docker-compose down || true

    # Start new container
    docker-compose up -d

    # Wait for health check
    echo "⏳ Waiting for service to be healthy..."
    for i in {1..30}; do
        if curl -f http://localhost:3002/health > /dev/null 2>&1; then
            echo "✅ Service is healthy!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ Health check failed after 30 seconds"
            exit 1
        fi
        sleep 1
    done

    # Clean up old images
    docker image prune -f

    echo "✨ Deployment complete!"
    echo "🔗 Access at: http://localhost:3002"

elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "🧪 Running in staging mode..."
    docker run --rm -d -p 3002:80 --name wdo-inspector-staging $IMAGE_NAME:$IMAGE_TAG
    echo "✨ Staging deployment complete!"
    echo "🔗 Access at: http://localhost:3002"
    echo "💡 To stop: docker stop wdo-inspector-staging"
else
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: ./deploy.sh [production|staging]"
    exit 1
fi
