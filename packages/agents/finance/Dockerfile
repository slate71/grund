FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Copy workspace package files
COPY package.json bun.lock ./
COPY packages/agents/finance/package.json ./packages/agents/finance/
COPY packages/logger/package.json ./packages/logger/

# Install dependencies
RUN bun install

# Copy source code
COPY packages/logger/src ./packages/logger/src
COPY packages/agents/finance/src ./packages/agents/finance/src
COPY packages/agents/finance/tsconfig.json ./packages/agents/finance/

WORKDIR /app/packages/agents/finance

EXPOSE 3004

CMD ["bun", "run", "src/index.ts"]
