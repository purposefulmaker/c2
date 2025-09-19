FROM node:18-alpine

WORKDIR /app

# Install dependencies for serial port
RUN apk add --no-cache python3 make g++ linux-headers

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 8090

CMD ["npm", "start"]