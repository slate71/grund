# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root files needed for the build
COPY tsconfig.json ./
COPY apps/wdo-inspector/package.json ./apps/wdo-inspector/
COPY apps/wdo-inspector/tsconfig.json ./apps/wdo-inspector/

# Install dependencies
WORKDIR /app/apps/wdo-inspector
RUN bun install

# Copy source files
COPY apps/wdo-inspector/ ./

# Build the app
RUN bun run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/apps/wdo-inspector/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/wdo-inspector/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
