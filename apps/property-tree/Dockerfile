# ==========================
# Build stage
# ==========================
FROM node:23-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json tsconfig*.json ./

COPY apps/property-tree ./apps/property-tree

# Install dependencies
RUN npm ci

# Build
RUN npm run build:property-tree

# ==========================
# Run stage
# ==========================
FROM nginx:alpine

RUN apk add --no-cache nodejs

WORKDIR /app

# Copy nginx configuration
COPY --from=builder /app/apps/property-tree/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/property-tree/dist /usr/share/nginx/html
COPY --from=builder /app/apps/property-tree/script ./script

# Actual run config
EXPOSE 80
RUN chmod +x ./script/entrypoint.sh

ENTRYPOINT ["script/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]