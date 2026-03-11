FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.json ./

RUN bun install --frozen-lockfile

COPY src ./src

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
