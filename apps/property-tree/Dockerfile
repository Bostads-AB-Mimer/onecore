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
COPY apps/property-tree ./apps/property-tree

RUN pnpm install
RUN pnpm build:types
RUN pnpm install
RUN pnpm run --filter @onecore/property-tree build
RUN pnpm install --only=prod
RUN pnpm deploy --filter @onecore/property-tree --prod /out

# ==========================
# Run stage
# ==========================
FROM nginx:alpine

RUN apk add --no-cache nodejs

WORKDIR /app

# Copy nginx configuration
COPY --from=builder /app/apps/property-tree/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/property-tree/script ./script
COPY --from=builder /out/dist /usr/share/nginx/html

# Actual run config
EXPOSE 80
RUN chmod +x ./script/entrypoint.sh

ENTRYPOINT ["script/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
