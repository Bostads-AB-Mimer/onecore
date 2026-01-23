# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.6.1 --activate

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy relevant packages
COPY libs/types ./libs/types
COPY apps/internal-portal/frontend ./apps/internal-portal/frontend

ARG BACKEND_URL
ENV VITE_BACKEND_URL=${BACKEND_URL}

RUN pnpm install
RUN pnpm build:types
RUN pnpm install
RUN pnpm run --filter @onecore/internal-portal build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/internal-portal --prod /out

# ==========================
# Run stage
# ==========================
FROM nginx:alpine AS runner

# Copy nginx configuration
COPY --from=builder /out/dist /usr/share/nginx/html
COPY --from=builder /out/nginx.conf /etc/nginx/conf.d/default.conf
