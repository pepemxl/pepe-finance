# pepe-finance

FinanceStocks — desktop portfolio & tax tracker (MXN-primary, USD secondary).

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
└── db/
    └── init.sql           # MySQL schema + seed data
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
