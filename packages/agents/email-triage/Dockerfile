FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Copy workspace package files
COPY package.json bun.lock ./
COPY packages/agents/email-triage/package.json ./packages/agents/email-triage/
COPY packages/logger/package.json ./packages/logger/

# Install dependencies
RUN bun install

# Copy source code
COPY packages/logger/src ./packages/logger/src
COPY packages/agents/email-triage/src ./packages/agents/email-triage/src
COPY packages/agents/email-triage/tsconfig.json ./packages/agents/email-triage/

WORKDIR /app/packages/agents/email-triage

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
