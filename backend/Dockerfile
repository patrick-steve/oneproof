# OneProof backend — Node + nargo + bb + compiled circuits.
#
# Build with the build context set to this backend/ directory. The
# prepare.sh script in this dir stages ../circuits and the companion
# proofs into backend/ before Fly's `fly deploy` picks it up, so the
# Dockerfile only ever references local paths.
#
# Three-stage build for layer cache + tiny runtime:
#   1. toolchain — installs nargo + bb at pinned versions to /opt
#   2. build     — npm install + tsc compile in clean node:slim
#   3. runtime   — slim node image with toolchain, JS, circuits, companions

# ─── Stage 1: toolchain ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates xz-utils tar git bash \
    && rm -rf /var/lib/apt/lists/*

# nargo at the same version that generated our committed proofs.
ENV NARGO_VERSION=1.0.0-beta.9
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash \
    && /root/.nargo/bin/noirup --version ${NARGO_VERSION} \
    && mkdir -p /opt/nargo && cp -r /root/.nargo/* /opt/nargo/

# bb (Barretenberg) at the pinned version.
ENV BB_VERSION=0.87.0
RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash \
    && /root/.bb/bbup -v ${BB_VERSION} \
    && mkdir -p /opt/bb && cp -r /root/.bb/bb /opt/bb/

# ─── Stage 2: backend build ────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# ─── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# Toolchain on PATH so child processes inherit it.
COPY --from=toolchain /opt/nargo /opt/nargo
COPY --from=toolchain /opt/bb    /opt/bb
ENV PATH="/opt/nargo/bin:/opt/bb:${PATH}"

# Backend code
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY              package.json      ./

# Circuits — staged here by prepare.sh from ../circuits before deploy.
# Contains both nargo source + the compiled .json + vk_fields.json, so
# bb can prove fresh witnesses against them at runtime.
COPY circuits  ./circuits

# Pre-baked companion proofs for Mode 1 (solo with companions). The user
# picks Mode 1 → backend pads their proof with these 3 to reach K=4 → runs
# the aggregator. Staged here by prepare.sh from web/public/example/.
COPY companions ./companions

EXPOSE 8080
ENV PORT=8080 NODE_ENV=production

# Non-root runtime
RUN groupadd --system app && useradd --system --gid app --no-create-home app && chown -R app:app /app
USER app

CMD ["node", "dist/server.js"]
