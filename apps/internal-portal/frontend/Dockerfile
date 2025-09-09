# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json tsconfig*.json ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY apps/internal-portal/frontend ./apps/internal-portal/frontend

RUN npm ci

ARG BACKEND_URL
ENV VITE_BACKEND_URL=${BACKEND_URL}

RUN npm run build:types
RUN npm run build --workspace=@onecore/internal-portal

# Remove stuff in node_modules we no longer need
RUN npm prune --omit=dev

# ==========================
# Run stage
# ==========================
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/apps/internal-portal/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/internal-portal/frontend/nginx.conf /etc/nginx/conf.d/default.conf
