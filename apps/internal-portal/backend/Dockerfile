# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json tsconfig.json ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY libs/utilities ./libs/utilities
COPY apps/internal-portal/backend ./apps/internal-portal/backend

# Install dependencies
RUN npm ci

# Build required libraries
RUN npm run build:libs

# Build application
RUN npm run build:internal-portal-backend

# Remove stuff in node_modules we no longer need
RUN npm prune --omit=dev

# ==========================
# Run stage
# ==========================
FROM node:23-slim AS runner

WORKDIR /app

COPY --from=builder /app/libs ./libs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/internal-portal/backend/package* ./
COPY --from=builder /app/apps/internal-portal/backend/build ./
COPY --from=builder /app/apps/internal-portal/backend/assets ./build/assets

ENV PORT=80
EXPOSE 80

CMD ["node", "build/index.js"]
