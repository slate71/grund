FROM oven/bun:1-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy workspace package files
COPY package.json bun.lock ./
COPY packages/agents/heartbeat/package.json ./packages/agents/heartbeat/
COPY packages/logger/package.json ./packages/logger/

# Install dependencies
RUN cd packages/agents/heartbeat && bun install --frozen-lockfile

# Copy source code
COPY packages/logger/src ./packages/logger/src
COPY packages/agents/heartbeat/src ./packages/agents/heartbeat/src
COPY packages/agents/heartbeat/tsconfig.json ./packages/agents/heartbeat/

WORKDIR /app/packages/agents/heartbeat

# Expose port
EXPOSE 3001

# Run the agent directly with bun (handles TypeScript)
CMD ["bun", "run", "src/index.ts"]
