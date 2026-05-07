FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /work

# stdlib-only — copy the whole etl package in
COPY etl /work/etl

ENTRYPOINT ["python", "-m", "etl.gbm.cli"]
CMD ["--input", "/work/LOCAL_DATA/GBM/ESTADOS_DE_CUENTA", "--output", "/work/build"]
