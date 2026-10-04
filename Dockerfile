# One image for the whole app: express serves the api under /api and the react build for
# everything else. client/ and server/ keep their own Dockerfiles for docker compose.

FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci
COPY client/ .

# vite inlines these at build time
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_STRIPE_PUBLISHABLE_KEY=
ARG VITE_PAYPAL_CLIENT_ID=
ARG VITE_DEMO_MODE=false
ENV VITE_BACKEND_URL=/api \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID \
    VITE_DEMO_MODE=$VITE_DEMO_MODE
RUN npm run build

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS server
COPY server/package.json server/package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci
COPY server/ .
# prisma generate only reads the schema, it never connects
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production \
    API_PREFIX=/api \
    CLIENT_DIR=/app/public
COPY server/package.json server/package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci --omit=dev && npm cache clean --force
COPY --from=server /app/dist ./dist
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
COPY --from=client /client/dist ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" > /dev/null || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
