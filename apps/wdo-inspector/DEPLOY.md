# WDO Inspector Deployment Guide

## Quick Start

### Local Development
```bash
bun install
bun run dev
# Visit http://localhost:3002
```

### Build for Production
```bash
bun run build
# Creates dist/ folder with static assets
```

## Deployment Options

### Option 1: Docker (Recommended)

Build and run with Docker:
```bash
docker build -t wdo-inspector .
docker run -p 3002:80 wdo-inspector
```

Or use docker-compose:
```bash
docker-compose up -d
```

### Option 2: Deploy to grund-server

1. Configure your server details:
```bash
export SERVER_HOST="your-server.com"
export SERVER_USER="root"
export DOMAIN="wdo.yourdomain.com"
```

2. Run deployment:
```bash
./deploy-to-server.sh
```

### Option 3: Static Files

The `dist/` folder contains all static files. You can serve them with any web server:

1. Build the app: `bun run build`
2. Copy `dist/` contents to your web server
3. Configure server for SPA routing (all routes → index.html)
4. Ensure proper MIME types for PWA files

### Option 4: Systemd Service (Linux)

1. Build and copy files:
```bash
bun run build
sudo mkdir -p /opt/wdo-inspector
sudo cp -r dist/* /opt/wdo-inspector/
sudo cp nginx-standalone.conf /opt/wdo-inspector/
```

2. Install service:
```bash
sudo cp wdo-inspector.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wdo-inspector
sudo systemctl start wdo-inspector
```

## Server Requirements

- HTTPS (required for PWA features)
- Port 3002 (or configure as needed)
- ~50MB disk space
- nginx or similar web server

## Traefik Configuration (if using)

Add these labels to docker-compose.yml:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.wdo.rule=Host(`wdo.yourdomain.com`)"
  - "traefik.http.routers.wdo.entrypoints=websecure"
  - "traefik.http.routers.wdo.tls.certresolver=letsencrypt"
```

## Environment Variables

None required - this is a client-side only application.

## Health Check

The app provides a health endpoint at `/health` that returns 200 OK.

## Troubleshooting

### Service Worker Issues
- Ensure HTTPS is enabled
- Check console for SW registration errors
- Clear browser cache if updating

### PWA Not Installing
- Verify manifest.json is served with correct MIME type
- Check HTTPS certificate is valid
- Ensure icons are present (currently missing, needs adding)

### Build Errors
- Run `bun install` to ensure dependencies are installed
- Check TypeScript errors with `bun run typecheck`

## Missing Assets

Note: The PWA manifest references icons that don't exist yet:
- `/icon-192.png` (192x192)
- `/icon-512.png` (512x512)

These should be added to `public/` before production deployment.