FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY libs ./libs/
COPY core ./core/

# Install all workspace dependencies from root
RUN npm ci

# Build only types (skip utilities due to EPIPE error)
RUN npm run build:types

# Generate and build core
WORKDIR /app/core
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:20-slim AS runner
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/core/package*.json ./
COPY --from=builder /app/core/build ./build

ENV PORT 80
EXPOSE 80

CMD node build/src/index.js
