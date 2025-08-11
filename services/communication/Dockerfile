FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY libs ./libs/
COPY services/communication ./services/communication/
# Copy communication's own tsconfig.json to override root config
COPY services/communication/tsconfig.json ./services/communication/

# Install all workspace dependencies from root
RUN npm ci

# Build only types (skip utilities due to segmentation fault)
RUN npm run build:types

# Generate and build communication
WORKDIR /app/services/communication
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:20-slim AS runner
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/communication/package*.json ./
COPY --from=builder /app/services/communication/src ./src

ENV PORT 80
EXPOSE 80

CMD node src/index.js
