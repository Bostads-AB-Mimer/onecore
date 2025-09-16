# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json tsconfig*.json ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY services/economy ./services/economy

# Install dependencies
RUN npm ci

# Build required libraries
RUN npm run build:libs

# Build application
RUN npm run build:leasing

# Remove stuff in node_modules we no longer need
RUN npm prune --omit=dev

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

WORKDIR /app
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/services/economy/build ./build
COPY --from=builder /app/services/economy/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/economy/knexfile.js .
COPY --from=builder /app/services/economy/migrations ./migrations


ENV PORT 80
EXPOSE 80

CMD ["npm", "run", "start"]