# `etl.backup` — MySQL backup to CSV + Parquet

Standalone sub-service that dumps every table of the `pepe_finance` database
to timestamped CSV **and** Parquet files. Useful for local snapshots,
ad-hoc analytics, or seeding a notebook.

## Output

Files land in `LOCAL_DATA/BACKUPS/` (override with `--output`). Each
backup run shares the same UTC timestamp so siblings are easy to spot:

```
LOCAL_DATA/BACKUPS/
  instruments_20260508T143002Z.csv
  instruments_20260508T143002Z.parquet
  transactions_20260508T143002Z.csv
  transactions_20260508T143002Z.parquet
  ...
```

## Run via docker compose (recommended)

The DB is reachable inside the compose network as `db`. Bring the stack up
first, then run the on-demand `backup` profile:

```bash
docker compose up -d db          # or: make up-d
docker compose --profile backup run --rm backup
```

Or via the Makefile:

```bash
make backup-docker
```

## Run locally

Requires Python 3.12 with the deps in `etl/backup/requirements.txt` and the
DB exposed on `127.0.0.1:3306` (the default in `docker-compose.yml`).

```bash
pip install -r etl/backup/requirements.txt
python3 -m etl.backup.cli --output LOCAL_DATA/BACKUPS --host 127.0.0.1
```

Or:

```bash
make backup
```

## Options

```
--output PATH     Output directory (default: LOCAL_DATA/BACKUPS)
--table NAME      Back up just this table; repeat for multiple. Default: all.
--host / --port / --user / --password / --database
                  Connection overrides (also picked up from
                  DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME).
```
