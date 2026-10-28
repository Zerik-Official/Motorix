FROM oven/bun:1.4.4-slim

LABEL org.opencontainers.image.source="https://github.com/Zerik-Official/Motorix"
LABEL org.opencontainers.image.description="auth-api of Motorix: accounts, login and RS256 tokens"

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

ENV ENVIRONMENT=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    LOG_TO_FILE=false

USER bun
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD bun -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "bun --bun prisma migrate deploy && exec bun src/index.ts"]
