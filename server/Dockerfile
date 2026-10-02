FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci

FROM deps AS build
COPY . .
# prisma generate only reads the schema, it never connects
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare && npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" > /dev/null || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
