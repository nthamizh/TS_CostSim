# syntax=docker/dockerfile:1.10
FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache python3 make g++
WORKDIR /repo

FROM base AS deps
COPY . .
ARG NODE_AUTH_TOKEN
RUN printf '@nthamizh:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "${NODE_AUTH_TOKEN}" > .npmrc && \
    pnpm install --no-frozen-lockfile --filter @costsim/api...
ARG CACHEBUST=1
RUN pnpm --filter @costsim/api build

FROM node:24-alpine AS runtime
RUN apk add --no-cache python3 make g++
WORKDIR /repo
COPY --from=deps /repo/package.json .
COPY --from=deps /repo/pnpm-workspace.yaml .
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps/api/package.json ./apps/api/package.json
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/apps/api/dist ./apps/api/dist
COPY --from=deps /repo/apps/api/src/db/migrations ./apps/api/dist/db/migrations
EXPOSE 4002
USER node
WORKDIR /repo/apps/api
CMD ["node", "dist/index.js"]
