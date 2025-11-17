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
COPY libs ./libs
COPY apps/property-tree ./apps/property-tree
COPY libs ./libs

RUN pnpm install
RUN pnpm build:types
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
