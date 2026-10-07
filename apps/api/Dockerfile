# Build from the repo root:  docker build -f apps/api/Dockerfile -t itu-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npx turbo run build --filter=@itu/api...

FROM node:22-alpine AS run
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
COPY apps/api/data apps/api/data
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
