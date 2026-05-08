FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /work

COPY etl/backup/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY etl /work/etl

ENTRYPOINT ["python", "-m", "etl.backup.cli"]
CMD ["--output", "/work/LOCAL_DATA/BACKUPS"]
