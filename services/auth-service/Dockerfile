FROM node:18-alpine AS builder

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including dev for building
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

########################################################
# Runtime image
FROM node:18-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install runtime dependencies only
COPY package*.json ./
RUN apk add --no-cache ca-certificates curl \
  && npm ci --only=production \
  && update-ca-certificates

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8085

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:8085/health || exit 1

# Start service
CMD ["node", "dist/index.js"]