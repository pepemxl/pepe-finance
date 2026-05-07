# pepe-finance

FinanceStocks — desktop portfolio & tax tracker (MXN-primary, USD secondary).

## Personal Tool

This is a tool under development don't use this tool to compute your taxes.

## Stack

- **Frontend** — React 18 + Vite (port `5173`)
- **Backend**  — FastAPI + SQLAlchemy 2 (port `8000`)
- **Database** — MySQL 8.4 (port `3306`)

## Layout

```
.
├── docker-compose.yml
├── frontend/              # Vite + React app
│   ├── Dockerfile         # multi-stage: dev / build / nginx prod
│   ├── nginx.conf         # serves /dist, proxies /api → backend
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── styles.css
│       ├── components/    # Shell, Dashboard, Screens
│       └── lib/           # api, hooks, format, i18n, demoData, portfolio
├── backend/               # FastAPI service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py      # SQLAlchemy ORM
│       ├── schemas.py     # Pydantic
│       └── routers/portfolio.py
├── db/
│   └── init.sql           # MySQL schema + seed data
├── etl/                   # Broker-statement ingestion (CFDI XML → CSV)
│   ├── Dockerfile
│   ├── README.md
│   └── gbm/
│       ├── parser.py
│       └── cli.py
├── LOCAL_DATA/            # Raw broker artefacts (gitignored)
│   └── GBM/ESTADOS_DE_CUENTA/
│       └── CB_*.xml
├── build/                 # ETL output (gitignored)
└── Makefile
```

## Run with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/...
- API docs: http://localhost:8000/docs
- MySQL: `localhost:3306` (`finance` / `finance`)

The frontend dev server proxies `/api/*` to the backend container.
The schema and seed data are loaded from `db/init.sql` on first MySQL boot.

## Run locally (without Docker)

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # adjust DB_HOST=localhost
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Database

Schema in `db/init.sql`. Tables:

- `instruments`, `brokers`, `accounts`, `prices`, `fx_rates`
- `transactions` (raw trades) — feeds the `/positions` aggregation
- `realized_lots` (FIFO-matched closes) — feeds `/realized` and `/tax/breakdown`
- `tax_settings`, `loss_carry_forward`

All money columns are `DECIMAL` to avoid float drift.

## API

```
GET  /health
GET  /api/positions
GET  /api/transactions
POST /api/transactions
GET  /api/realized
GET  /api/allocation
GET  /api/performance
GET  /api/tax/breakdown?year=2026
GET  /api/fx/usd-mxn
```

If the backend is unreachable, the frontend falls back to the bundled
`demoData.js` so the prototype keeps working.

## ETL — broker statements → CSV

`etl/` contains sub-services that turn raw broker artefacts into CSVs the
rest of the system can ingest. Today only **GBM** is implemented.

### `etl.gbm` — GBM CFDI 4.0 statements

Parses every `CB_*.xml` in `LOCAL_DATA/GBM/ESTADOS_DE_CUENTA/`. Each XML is
a SAT electronic invoice; the actual portfolio movements live as a free-text
table inside `<cfdi:Addenda><Movimientos>`.

Drop your statements in:

```
LOCAL_DATA/GBM/ESTADOS_DE_CUENTA/CB_<period>_<contract>.xml
```

(e.g. `CB_20241_AFF35401.xml`). The directory is gitignored.

#### Run

```bash
# stdlib-only — no extra deps
make etl-gbm

# or explicitly
python3 -m etl.gbm.cli \
    --input  LOCAL_DATA/GBM/ESTADOS_DE_CUENTA \
    --output build

# or in a one-shot container
make etl-gbm-docker
# = docker compose --profile etl run --rm etl
```

The `etl` service is profile-gated, so it does NOT start with
`docker compose up`; you have to invoke it explicitly.

#### Output

Two files in `build/`:

| File                  | One row per         | Use for                              |
|-----------------------|---------------------|--------------------------------------|
| `gbm_invoices.csv`    | CFDI invoice (XML)  | audit trail (UUID, folio, IVA, totals) |
| `gbm_movements.csv`   | movement line       | feeds the system's transactions     |

`gbm_invoices.csv` columns:
`source_file, serie, folio, fecha, uuid, fecha_timbrado, moneda,
 subtotal_mxn, iva_mxn, total_mxn, issuer_rfc, issuer_name,
 receiver_rfc, receiver_name`

`gbm_movements.csv` columns:
`source_file, invoice_uuid, statement_period, contract, date,
 description, inferred_type, amount_mxn, folio`

`inferred_type` is a heuristic classification:
`INTEREST | FEE | BUY | SELL | DIV | TRANSFER | TAX | OTHER`.
Extend the patterns in `etl/gbm/parser.py` (`_KIND_PATTERNS`) when new
broker descriptions appear in real statements.

## Makefile cheat-sheet

```bash
make help            # list every target with its description

# stack
make up              # docker compose up --build (foreground)
make up-d            # detached
make down            # stop containers (keep volumes)
make nuke            # stop + drop the MySQL volume (DESTROYS data)
make logs            # tail all services
make logs-backend    # backend only (also logs-frontend, logs-db)

# shells
make sh-backend      # bash inside the backend container
make sh-frontend     # sh inside the frontend container
make sh-db           # mysql client connected to the dev DB

# database
make db-reset        # drop volume + re-seed from db/init.sql
make db-dump         # mysqldump → ./db/dump.sql

# etl
make etl-gbm         # parse XML statements locally
make etl-gbm-docker  # same, inside a one-shot container

# local dev (no docker)
make install         # backend venv + pip + frontend npm install
make dev-backend     # uvicorn --reload
make dev-frontend    # vite dev server
make build-frontend  # production build → frontend/dist
make clean           # nuke node_modules, dist, .venv, __pycache__
```
