# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY client/package.json ./client/package.json
COPY staff/package.json ./staff/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY shared ./shared
COPY client ./client
COPY staff ./staff
RUN npm run build -w client
RUN npm run build -w staff

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY client/package.json ./client/package.json
COPY staff/package.json ./staff/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev -w server
COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/prisma.config.ts
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm run prisma:generate -w server

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

RUN apk add --no-cache bash sudo wget ca-certificates openssl \
  && wget -qO- 'https://artifacts-cli.infisical.com/setup.apk.sh' | sh \
  && apk update && apk add --no-cache infisical \
  && infisical --version

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY server/package.json ./server/package.json
COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/prisma.config.ts
COPY server/src ./server/src
COPY server/scripts ./server/scripts
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/staff/dist ./staff/dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && chown -R app:app /app

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/server
CMD ["/app/docker-entrypoint.sh"]
