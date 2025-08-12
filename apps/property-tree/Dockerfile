FROM node:23-alpine AS builder

WORKDIR /app

# Copy root workspace files first
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/property-tree ./apps/property-tree/

# Install all workspace dependencies from root
RUN npm ci

# Generate and build property-tree
WORKDIR /app/apps/property-tree

# Install dependencies (use npm install to handle version mismatches)
RUN npm install

ARG VITE_CORE_API_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_KEYCLOAK_REDIRECT_URI
ARG VITE_KEYCLOAK_REALM

ENV VITE_CORE_API_URL=${VITE_CORE_API_URL}
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}
ENV VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID}
ENV VITE_KEYCLOAK_REDIRECT_URI=${VITE_KEYCLOAK_REDIRECT_URI}
ENV VITE_KEYCLOAK_REALM=${VITE_KEYCLOAK_REALM}

# Build
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/apps/property-tree/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
