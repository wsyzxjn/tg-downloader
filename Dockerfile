# Dockerfile

# Stage 1: Builder
FROM node:24-slim AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy configuration files
COPY package.json pnpm-lock.yaml ./
COPY web/package.json ./web/

# Install dependencies
# Note: If you are not using pnpm workspaces, you might need to recursively install.
# Assuming the root pnpm-lock.yaml covers the project structure.
RUN pnpm install --frozen-lockfile

# Install web dependencies explicitly since it might not be a workspace
RUN cd web && pnpm install

# Copy source code
COPY . .

# Build the project
# This command runs 'tsup' and 'pnpm run build:web' based on package.json scripts
RUN pnpm run build

# Prune dev dependencies for production
RUN pnpm prune --prod

# Stage 2: Runner
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Improve performance for node
ENV NODE_OPTIONS="--enable-source-maps"

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Create a volume for downloads and config to persist data
VOLUME ["/app/downloads", "/app/config"]

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
