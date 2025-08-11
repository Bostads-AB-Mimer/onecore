FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY libs ./libs/
COPY services/work-order ./services/work-order/

# Install all workspace dependencies from root
RUN npm ci

# Build libs first (required for work-order)
RUN npm run build:libs

# Generate and build work-order
WORKDIR /app/services/work-order
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/work-order/package*.json ./
COPY --from=builder /app/services/work-order/build ./build

ENV PORT 80
EXPOSE 80

CMD node build/index.js
