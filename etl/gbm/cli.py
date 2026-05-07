"""CLI: scan a directory of GBM CFDI XMLs and emit two CSV files."""
from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import asdict, fields
from pathlib import Path

from .parser import Invoice, Movement, parse_xml


def _write_csv(path: Path, rows: list, dataclass_type) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[fld.name for fld in fields(dataclass_type)])
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="etl.gbm",
        description="Convert GBM account-statement XMLs (SAT CFDI 4.0) to CSV.",
    )
    p.add_argument("--input",  default="LOCAL_DATA/GBM/ESTADOS_DE_CUENTA",
                   help="Directory containing CB_*.xml statements.")
    p.add_argument("--output", default="build",
                   help="Output directory for CSV files.")
    p.add_argument("--movements-name", default="gbm_movements.csv")
    p.add_argument("--invoices-name",  default="gbm_invoices.csv")
    args = p.parse_args(argv)

    in_dir = Path(args.input)
    if not in_dir.is_dir():
        print(f"Input directory not found: {in_dir}", file=sys.stderr)
        return 2

    xmls = sorted(in_dir.glob("*.xml"))
    if not xmls:
        print(f"No *.xml files in {in_dir}", file=sys.stderr)
        return 1

    invoices: list[Invoice] = []
    movements: list[Movement] = []
    failures = 0
    for path in xmls:
        try:
            inv, mvs = parse_xml(path)
        except Exception as exc:
            print(f"  ! {path.name}: {exc}", file=sys.stderr)
            failures += 1
            continue
        invoices.append(inv)
        movements.extend(mvs)
        print(f"  ✓ {path.name}: {len(mvs):4d} movements")

    out_dir = Path(args.output)
    inv_path = out_dir / args.invoices_name
    mov_path = out_dir / args.movements_name

    _write_csv(inv_path, invoices, Invoice)
    _write_csv(mov_path, movements, Movement)

    print()
    print(f"  invoices:  {len(invoices):4d}  → {inv_path}")
    print(f"  movements: {len(movements):4d}  → {mov_path}")
    if failures:
        print(f"  failures:  {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
