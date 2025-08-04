FROM node:18-slim as BUILDER

WORKDIR /home/app

# Help Docker cache npm install if neither of these files have changed
ADD ./package.json ./package-lock.json ./
RUN npm ci

ADD ./ ./
RUN npm run build

# Remove stuff in node_modules we no longer need
ENV NODE_ENV production
RUN npm prune --production

# A slimmed down runner image with only the bare necessities
FROM node:18-slim AS runner
WORKDIR /home/app
COPY --from=BUILDER /home/app/node_modules ./node_modules
COPY --from=BUILDER /home/app/package* ./
COPY --from=BUILDER /home/app/build ./
COPY --from=BUILDER /home/app/assets ./assets

ENV PORT 80
EXPOSE 80

CMD node index.js