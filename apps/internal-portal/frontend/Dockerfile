FROM node:18-slim AS builder

WORKDIR /app
ADD package*.json .
RUN npm ci
ADD . .

ARG BACKEND_URL
ENV VITE_BACKEND_URL=${BACKEND_URL}

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
