# OneProof backend — Node + nargo + bb + compiled circuits.
#
# Base image: ubuntu:24.04 (glibc 2.39, libstdc++ from gcc 13) — bb
# 0.87.0 was built against a newer toolchain than what's in Debian
# bookworm-slim. Bookworm gave us:
#   bb: GLIBC_2.38 not found (have 2.36)
#   bb: GLIBCXX_3.4.31 not found
# Ubuntu 24.04 has both. We pay ~10s of extra build time for the manual
# Node install via NodeSource.
#
# Build with build-context = this backend/ directory. prepare.sh stages
# ../circuits and the companion proofs into backend/ before fly deploy.

# ─── Stage 1: toolchain ────────────────────────────────────────────────
FROM ubuntu:24.04 AS toolchain
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates xz-utils tar git bash \
    && rm -rf /var/lib/apt/lists/*

ENV NARGO_VERSION=1.0.0-beta.9
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash \
    && /root/.nargo/bin/noirup --version ${NARGO_VERSION} \
    && mkdir -p /opt/nargo && cp -r /root/.nargo/* /opt/nargo/

ENV BB_VERSION=0.87.0
RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash \
    && /root/.bb/bbup -v ${BB_VERSION} \
    && mkdir -p /opt/bb && cp -r /root/.bb/bb /opt/bb/

# ─── Stage 2: backend build ────────────────────────────────────────────
FROM ubuntu:24.04 AS build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# ─── Stage 3: runtime ─────────────────────────────────────────────────
FROM ubuntu:24.04 AS runtime
ENV DEBIAN_FRONTEND=noninteractive
# bb shells out to jq + gzip for its bytes_and_fields output pipeline;
# we hit "sh: jq: not found" without them. xz-utils + tar are similar
# common deps for the toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates jq gzip xz-utils tar \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Toolchain on PATH for child processes
COPY --from=toolchain /opt/nargo /opt/nargo
COPY --from=toolchain /opt/bb    /opt/bb
ENV PATH="/opt/nargo/bin:/opt/bb:${PATH}"

# Backend code
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY              package.json      ./

# Circuits + companions, staged by prepare.sh
COPY circuits   ./circuits
COPY companions ./companions

EXPOSE 8080
ENV PORT=8080 NODE_ENV=production

# Non-root user WITH a home dir so nargo can write its git-cache lock.
# Pre-warm by resolving the aggregator's git dep at build time so first
# runtime call doesn't pay the latency.
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /home/app --create-home app \
    && chown -R app:app /app /home/app
ENV HOME=/home/app
USER app
RUN cd /app/circuits/aggregator && (nargo info 2>&1 | tail -3) || true

CMD ["node", "dist/server.js"]
