FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

RUN bun install

COPY src ./src

EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
