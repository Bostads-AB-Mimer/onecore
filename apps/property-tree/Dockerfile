FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY ./package*.json /app/

COPY ./packages/property-tree /app/packages/property-tree

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

# Install dependencies
RUN npm ci --workspace packages/property-tree

# Build
WORKDIR /app/packages/property-tree
RUN npm run build

# Production image
FROM nginx:alpine

# Copy nginx configuration
COPY --from=builder /app/packages/property-tree/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/property-tree/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
