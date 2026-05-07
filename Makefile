# pepe-finance — convenience targets
# Use `make` or `make help` to see what's available.

DC          ?= docker compose
PROJECT     ?= pepe-finance
BACKEND     := backend
FRONTEND    := frontend
DB          := db

.DEFAULT_GOAL := help

# ---------- meta ----------------------------------------------------

.PHONY: help
help: ## Show this help
	@awk 'BEGIN { FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n" } \
	     /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	     /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Docker stack

.PHONY: up
up: ## Start the full stack (db + backend + frontend) in the foreground
	$(DC) up --build

.PHONY: up-d
up-d: ## Start the full stack detached
	$(DC) up --build -d

.PHONY: down
down: ## Stop and remove containers (keep volumes)
	$(DC) down

.PHONY: nuke
nuke: ## Stop containers and DELETE the MySQL volume (destroys data)
	$(DC) down -v

.PHONY: build
build: ## Rebuild all images
	$(DC) build

.PHONY: rebuild
rebuild: ## Rebuild without cache
	$(DC) build --no-cache

.PHONY: ps
ps: ## Show container status
	$(DC) ps

.PHONY: logs
logs: ## Tail logs for all services
	$(DC) logs -f --tail=200

.PHONY: logs-backend logs-frontend logs-db
logs-backend: ## Tail backend logs
	$(DC) logs -f --tail=200 $(BACKEND)
logs-frontend: ## Tail frontend logs
	$(DC) logs -f --tail=200 $(FRONTEND)
logs-db: ## Tail MySQL logs
	$(DC) logs -f --tail=200 $(DB)

.PHONY: restart
restart: ## Restart all services
	$(DC) restart

##@ Shells

.PHONY: sh-backend
sh-backend: ## Open a shell inside the backend container
	$(DC) exec $(BACKEND) bash

.PHONY: sh-frontend
sh-frontend: ## Open a shell inside the frontend container
	$(DC) exec $(FRONTEND) sh

.PHONY: sh-db
sh-db: ## Open a mysql client connected to the dev DB
	$(DC) exec $(DB) mysql -ufinance -pfinance pepe_finance

##@ Database

.PHONY: db-reset
db-reset: ## Drop volume and re-seed from db/init.sql (DESTROYS data)
	$(DC) down -v
	$(DC) up -d $(DB)

.PHONY: db-dump
db-dump: ## Dump the dev database to ./db/dump.sql
	$(DC) exec $(DB) mysqldump -ufinance -pfinance pepe_finance > db/dump.sql
	@echo "Wrote db/dump.sql"

##@ Local (no docker)

.PHONY: install
install: install-backend install-frontend ## Install backend and frontend deps locally

.PHONY: install-backend
install-backend: ## pip install backend deps (in backend/.venv)
	cd $(BACKEND) && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

.PHONY: install-frontend
install-frontend: ## npm install frontend deps
	cd $(FRONTEND) && npm install

.PHONY: dev-backend
dev-backend: ## Run uvicorn locally (requires install-backend + DB reachable on localhost)
	cd $(BACKEND) && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

.PHONY: dev-frontend
dev-frontend: ## Run Vite dev server locally
	cd $(FRONTEND) && npm run dev

.PHONY: build-frontend
build-frontend: ## Production build of frontend → frontend/dist
	cd $(FRONTEND) && npm run build

##@ Housekeeping

.PHONY: clean
clean: ## Remove local build artefacts (node_modules, dist, __pycache__, venv)
	rm -rf $(FRONTEND)/node_modules $(FRONTEND)/dist $(FRONTEND)/.vite
	rm -rf $(BACKEND)/.venv
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
