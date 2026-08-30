# syntax=docker/dockerfile:1.10
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY . .
ARG NODE_AUTH_TOKEN
RUN printf '@nthamizh:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "${NODE_AUTH_TOKEN}" > .npmrc && \
    pnpm install --no-frozen-lockfile --filter @costsim/web...

FROM deps AS build
ARG VITE_API_URL=/
ARG CACHEBUST=1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @costsim/web build

FROM node:24-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /repo/apps/web/dist ./dist
EXPOSE 5175
USER node
CMD ["serve", "-s", "dist", "-l", "5175"]
