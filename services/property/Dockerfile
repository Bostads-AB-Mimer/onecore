FROM node:23-slim as builder

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy root package files and workspace configuration
COPY package*.json ./
COPY libs/ ./libs/
COPY services/property/ ./services/property/

# Install all dependencies (including workspace dependencies)
RUN npm ci

# Generate Prisma client and build
WORKDIR /app/services/property
RUN npm run generate

# Production stage
FROM node:23-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/property ./

EXPOSE 3000

CMD ["npm", "start"]
