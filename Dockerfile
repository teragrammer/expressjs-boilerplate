# syntax=docker/dockerfile:1

#
# Production image.
#
# Multi-stage: the builder installs the full dependency tree and
# compiles TypeScript; the runtime only carries the compiled output and
# the production dependencies. The runtime stage runs as a non-root user
# and contains no development tooling, no SSH configuration and no
# source code.
#

# ---------------------------------------------------------------- builder
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Install the full dependency tree (including dev dependencies) once.
COPY package.json package-lock.json ./
RUN npm ci

# Compile the application.
COPY tsconfig.json ./
COPY src ./src
COPY database ./database
COPY docs ./docs
RUN npm run build

# Prune to the production dependency tree.
RUN npm prune --omit=dev

# ---------------------------------------------------------------- runtime
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# `tini` reaps zombies and forwards signals to the Node process, which
# the graceful shutdown handler relies on.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled application and the production dependencies.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/database ./database
COPY --from=builder --chown=node:node /app/docs ./docs

# Run as the unprivileged `node` user shipped with the base image.
USER node

# Document the default listening port; overridable at build time via
# the PORT build argument (sourced from .env by Docker Compose).
ARG PORT=4000
EXPOSE ${PORT}

STOPSIGNAL SIGTERM

# The liveness endpoint answers without touching a dependency.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||4000,path:'/health/live',timeout:4000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/src/index.js"]
