FROM node:18-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY libs ./libs/
COPY core ./core/
COPY apps/internal-portal/backend ./apps/internal-portal/backend/

# Install all workspace dependencies from root
RUN npm ci

# Build only types and core (skip utilities due to EPIPE error)
RUN npm run build:types
RUN npm run build:core

# Generate and build internal-portal-backend
WORKDIR /app/apps/internal-portal/backend
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:18-slim AS runner
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/internal-portal/backend/package*.json ./
COPY --from=builder /app/apps/internal-portal/backend/build ./build
COPY --from=builder /app/apps/internal-portal/backend/assets ./assets

ENV PORT 80
EXPOSE 80

CMD node build/index.js
