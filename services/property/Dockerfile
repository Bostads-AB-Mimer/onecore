FROM node:23-slim as builder

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma client
RUN npm run generate

# Build the application
RUN npm run build

# Production stage
FROM node:23-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "start"]
