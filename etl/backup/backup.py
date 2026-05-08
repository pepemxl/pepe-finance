"""Dump every table of a MySQL schema to timestamped CSV + Parquet files."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine


@dataclass(frozen=True)
class DBConfig:
    host: str
    port: int
    user: str
    password: str
    name: str

    @property
    def url(self) -> str:
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.name}?charset=utf8mb4"
        )


@dataclass(frozen=True)
class TableBackup:
    table: str
    rows: int
    csv_path: Path
    parquet_path: Path


def make_engine(cfg: DBConfig) -> Engine:
    return create_engine(cfg.url, pool_pre_ping=True, future=True)


def list_tables(engine: Engine) -> list[str]:
    return sorted(inspect(engine).get_table_names())


def timestamp() -> str:
    """UTC timestamp safe for filenames: 20260508T143002Z."""
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def dump_table(
    engine: Engine,
    table: str,
    out_dir: Path,
    stamp: str,
) -> TableBackup:
    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_sql_table(table, con=engine)

    csv_path = out_dir / f"{table}_{stamp}.csv"
    parquet_path = out_dir / f"{table}_{stamp}.parquet"

    df.to_csv(csv_path, index=False)
    df.to_parquet(parquet_path, index=False, engine="pyarrow")

    return TableBackup(table=table, rows=len(df), csv_path=csv_path, parquet_path=parquet_path)


def backup_all(
    cfg: DBConfig,
    out_dir: Path,
    tables: list[str] | None = None,
    stamp: str | None = None,
) -> list[TableBackup]:
    """Back up every table (or the given subset) to CSV + Parquet."""
    engine = make_engine(cfg)
    try:
        targets = tables if tables else list_tables(engine)
        ts = stamp or timestamp()
        return [dump_table(engine, t, out_dir, ts) for t in targets]
    finally:
        engine.dispose()
