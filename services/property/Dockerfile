# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

# Prisma requires openssl to generate client
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy root package files for dependency installation
COPY package*.json tsconfig*.json ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/property ./services/property

# Install dependencies
RUN npm ci

# Build required libraries
RUN npm run build:libs

# Generate Prisma client
WORKDIR /app/services/property
RUN npm run generate:static

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

# Run on the same version of openssl as the prisma build
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY --from=builder /app/libs ./libs
COPY --from=builder /app/services/property ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
