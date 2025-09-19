FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only package files first for caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies inside the container
RUN pnpm install --no-frozen-lockfile

# Copy the rest of your source code
COPY . .

EXPOSE 3001

CMD ["pnpm", "dev"]