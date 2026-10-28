FROM oven/bun:1.4.4-slim AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_AUTH_API_URL=http://localhost:3000
ARG VITE_BUSINESS_API_URL=http://localhost:8000
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_SITE_URL=http://localhost:5173
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL \
    VITE_BUSINESS_API_URL=$VITE_BUSINESS_API_URL \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_SITE_URL=$VITE_SITE_URL

RUN bun run build

FROM nginx:1.29-alpine

LABEL org.opencontainers.image.source="https://github.com/Zerik-Official/Motorix"
LABEL org.opencontainers.image.description="Web app of Motorix, served as static files"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD wget --quiet --spider http://127.0.0.1/ || exit 1
