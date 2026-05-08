"""CLI: back up a MySQL database to timestamped CSV + Parquet files."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .backup import DBConfig, backup_all, timestamp


def _env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        raise SystemExit(f"Missing required env var: {name}")
    return val


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="etl.backup",
        description="Dump every MySQL table to CSV and Parquet files (timestamped).",
    )
    p.add_argument("--output", default="LOCAL_DATA/BACKUPS",
                   help="Output directory for backup files.")
    p.add_argument("--table", action="append", default=None,
                   help="Specific table to back up. Repeat for multiple. Default: all tables.")
    p.add_argument("--host",     default=os.environ.get("DB_HOST", "db"))
    p.add_argument("--port",     type=int, default=int(os.environ.get("DB_PORT", "3306")))
    p.add_argument("--user",     default=os.environ.get("DB_USER", "finance"))
    p.add_argument("--password", default=os.environ.get("DB_PASSWORD", "finance"))
    p.add_argument("--database", default=os.environ.get("DB_NAME", "pepe_finance"))
    args = p.parse_args(argv)

    cfg = DBConfig(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        name=args.database,
    )
    out_dir = Path(args.output)
    stamp = timestamp()

    print(f"  → backing up {cfg.name}@{cfg.host}:{cfg.port} into {out_dir} (stamp={stamp})")

    try:
        results = backup_all(cfg, out_dir=out_dir, tables=args.table, stamp=stamp)
    except Exception as exc:
        print(f"  ! backup failed: {exc}", file=sys.stderr)
        return 1

    if not results:
        print("  ! no tables found to back up", file=sys.stderr)
        return 1

    for r in results:
        print(f"  ✓ {r.table:24s} {r.rows:6d} rows  →  {r.csv_path.name}  +  {r.parquet_path.name}")

    print()
    print(f"  tables backed up: {len(results)}  (out: {out_dir})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
