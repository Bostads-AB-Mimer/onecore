# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

ENV CI=true

WORKDIR /app

# Copy package files for dependency installation
COPY package.json tsconfig*.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm using version from package.json
RUN corepack enable && corepack prepare --activate

# Copy relevant packages
COPY libs ./libs
COPY apps/leasing-portal/frontend ./apps/leasing-portal/frontend

RUN pnpm install
# Build workspace dependencies (ui, types) the same way CI does
RUN pnpm run --filter @onecore/leasing-portal-frontend... --filter !@onecore/leasing-portal-frontend build
RUN pnpm install
RUN pnpm run --filter @onecore/leasing-portal-frontend build

# ==========================
# Run stage
# ==========================
FROM nginx:alpine

RUN apk add --no-cache nodejs

WORKDIR /app

# Copy nginx configuration
COPY --from=builder /app/apps/leasing-portal/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/leasing-portal/frontend/script ./script
COPY --from=builder /app/apps/leasing-portal/frontend/dist/app /usr/share/nginx/html

# Actual run config
EXPOSE 80
RUN chmod +x ./script/entrypoint.sh

ENTRYPOINT ["script/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
