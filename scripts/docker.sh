#!/bin/bash

# Grund Docker Management Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_usage() {
    echo "Usage: ./scripts/docker.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up-infra        - Start infrastructure services (PostgreSQL, Redis)"
    echo "  up-agents       - Start all agents (uses existing images)"
    echo "  rebuild-agents  - Rebuild and start agents (forces fresh build)"
    echo "  up-all          - Start everything (infra + agents)"
    echo "  down            - Stop everything"
    echo "  logs [name]     - Show logs (optional: specify service name)"
    echo "  restart         - Restart agents only"
    echo "  status          - Show running containers"
    echo ""
}

case "$1" in
    "up-infra")
        echo -e "${GREEN}Starting infrastructure...${NC}"
        docker-compose -f docker-compose.base.yml up -d
        ;;
    "up-agents")
        echo -e "${GREEN}Starting agents...${NC}"
        docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml up -d heartbeat-agent
        ;;
    "rebuild-agents")
        echo -e "${GREEN}Rebuilding and starting agents...${NC}"
        docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml up -d --build heartbeat-agent
        ;;
    "up-all")
        echo -e "${GREEN}Starting everything...${NC}"
        docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml up -d
        ;;
    "down")
        echo -e "${YELLOW}Stopping everything...${NC}"
        docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml down
        ;;
    "logs")
        if [ -n "$2" ]; then
            docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml logs -f "$2"
        else
            docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml logs -f
        fi
        ;;
    "restart")
        echo -e "${YELLOW}Restarting agents...${NC}"
        docker-compose -f docker-compose.agents.yml restart
        ;;
    "status")
        docker-compose -f docker-compose.base.yml -f docker-compose.agents.yml ps
        ;;
    *)
        print_usage
        ;;
esac
