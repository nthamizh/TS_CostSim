# syntax=docker/dockerfile:1.10
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
ARG NODE_AUTH_TOKEN
RUN printf '@nthamizh:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "${NODE_AUTH_TOKEN}" > .npmrc && \
    pnpm install --no-frozen-lockfile --filter @costsim/worker...
ARG CACHEBUST=1
RUN pnpm --filter @costsim/worker build

FROM node:24-alpine AS runtime
WORKDIR /repo
COPY --from=deps /repo/package.json .
COPY --from=deps /repo/pnpm-workspace.yaml .
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps/worker/package.json ./apps/worker/package.json
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/apps/worker/dist ./apps/worker/dist
USER node
WORKDIR /repo/apps/worker
CMD ["node", "dist/index.js"]
