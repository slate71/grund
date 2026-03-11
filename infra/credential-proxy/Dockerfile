FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY src ./src

EXPOSE 9876

CMD ["bun", "run", "src/index.ts"]
