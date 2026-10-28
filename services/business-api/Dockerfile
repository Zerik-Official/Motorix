FROM python:3.12-slim

LABEL org.opencontainers.image.source="https://github.com/Zerik-Official/Motorix"
LABEL org.opencontainers.image.description="business-api of Motorix: clients, engines and repair orders"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install .

COPY alembic.ini ./
COPY migrations ./migrations

RUN useradd --create-home --uid 1000 motorix
USER motorix

ENV ENVIRONMENT=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    LOG_TO_FILE=false

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["sh", "-c", "alembic upgrade head && exec python -m app"]
