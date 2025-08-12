FROM node:20-slim AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY libs ./libs/
COPY apps/internal-portal/frontend ./apps/internal-portal/frontend/

# Install all workspace dependencies from root
RUN npm ci

# Build libs first (required for internal-portal-frontend)
RUN npm run build:libs

# Generate and build internal-portal-frontend
WORKDIR /app/apps/internal-portal/frontend

ARG BACKEND_URL
ENV VITE_BACKEND_URL=${BACKEND_URL}

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/internal-portal/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/internal-portal/frontend/nginx.conf /etc/nginx/conf.d/default.conf
