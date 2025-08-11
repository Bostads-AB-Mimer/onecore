FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY libs ./libs/
COPY services/property-management ./services/property-management/

# Install all workspace dependencies from root
RUN npm ci

# Build libs first (required for property-management)
RUN npm run build:libs

# Generate and build property-management
WORKDIR /app/services/property-management
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:20-slim AS runner
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/property-management/package*.json ./
COPY --from=builder /app/services/property-management/build ./build
COPY --from=builder /app/services/property-management/knexfile.js ./
COPY --from=builder /app/services/property-management/migrations ./migrations

ENV PORT 80
EXPOSE 80

CMD node build/index.js
