FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3001

# Run the agent directly with bun (handles TypeScript)
CMD ["bun", "run", "src/index.ts"]
