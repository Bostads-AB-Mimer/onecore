FROM node:18-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY ../../package*.json ./
COPY ../../libs ./libs/
COPY ../../services/communication ./services/communication/

# Install all workspace dependencies from root
RUN npm ci --legacy-peer-deps

# Build libs first (required for communication)
RUN npm run build:libs

# Generate and build communication
WORKDIR /app/services/communication
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:18-slim AS runner
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/communication/package*.json ./
COPY --from=builder /app/services/communication/build ./build

ENV PORT 80
EXPOSE 80

CMD node build/index.js
