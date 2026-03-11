FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json ./

RUN bun install

COPY src ./src

EXPOSE 9876

CMD ["bun", "run", "src/index.ts"]
