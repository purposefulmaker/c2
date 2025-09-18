FROM oven/bun:latest

WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

EXPOSE 3000 4001/udp 8081

CMD ["bun", "run", "start"]