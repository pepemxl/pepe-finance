# etl/ — broker statement ingestion

Sub-services that turn broker artefacts into CSVs the rest of the system
can consume.

## `etl.gbm` — GBM CFDI 4.0 statements

Parses every `CB_*.xml` in `LOCAL_DATA/GBM/ESTADOS_DE_CUENTA/`. Each XML is
a SAT electronic invoice; the actual portfolio movements live as a free-text
table inside `<cfdi:Addenda><Movimientos>`.

Outputs two files into `build/`:

- **`gbm_invoices.csv`** — one row per CFDI:
  `source_file, serie, folio, fecha, uuid, fecha_timbrado, moneda,
   subtotal_mxn, iva_mxn, total_mxn, issuer_rfc, issuer_name,
   receiver_rfc, receiver_name`
- **`gbm_movements.csv`** — one row per movement line:
  `source_file, invoice_uuid, statement_period, contract, date, description,
   inferred_type, amount_mxn, folio`

`inferred_type` is a heuristic classification:
`INTEREST | FEE | BUY | SELL | DIV | TRANSFER | TAX | OTHER`.

### Run locally

```bash
python3 -m etl.gbm.cli                       # uses defaults
python3 -m etl.gbm.cli \
    --input LOCAL_DATA/GBM/ESTADOS_DE_CUENTA \
    --output build
```

Or via the Makefile:

```bash
make etl-gbm
```

### Run via docker compose

The `etl` service is gated behind a profile so it doesn't start with
`docker compose up`. Trigger it on demand:

```bash
docker compose --profile etl run --rm etl
```

The container mounts `LOCAL_DATA/` read-only and writes CSVs into `build/`.
