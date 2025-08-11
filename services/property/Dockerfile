FROM node:23-slim AS builder

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy root workspace files first
COPY ../../package*.json ./
COPY ../../libs ./libs/
COPY ../../services/property ./services/property/

# Install all workspace dependencies from root
RUN npm ci

# Generate Prisma client and build
WORKDIR /app/services/property
RUN npm run prisma:generate
RUN npm run build

# Production stage
FROM node:23-slim AS runner

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/property/package*.json ./
COPY --from=builder /app/services/property/*.js ./
COPY --from=builder /app/services/property/src ./src
COPY --from=builder /app/services/property/prisma ./prisma

EXPOSE 3000

CMD ["npm", "start"]
