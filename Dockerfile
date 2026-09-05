# Dockerfile

# Stage 1: Builder
FROM node:24-slim AS builder

ARG TARGETARCH=amd64

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Download tdl binary for TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tar && \
    ARCH="${TARGETARCH:-amd64}" && \
    case "${ARCH}" in \
      "amd64") TDL_ARCH="64bit" ;; \
      "arm64") TDL_ARCH="arm64" ;; \
      *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/iyear/tdl/releases/download/v0.20.4/tdl_Linux_${TDL_ARCH}.tar.gz" | tar -xz -C /usr/local/bin tdl && \
    chmod +x /usr/local/bin/tdl

# Copy configuration files
COPY package.json pnpm-lock.yaml ./
COPY web/package.json ./web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Install web dependencies explicitly since it might not be a workspace
RUN cd web && pnpm install

# Copy source code
COPY . .

# Build the project
RUN pnpm run build

# Prune dev dependencies for production
RUN pnpm prune --prod

# Stage 2: Runner
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

# Copy tdl binary from builder
COPY --from=builder /usr/local/bin/tdl /usr/local/bin/tdl

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
