.PHONY: up down build migrate migrate-create test lint keys help

COMPOSE=docker compose
API_CONTAINER=his_ris_api

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Docker ───────────────────────────────────────────────────────────────────
up:  ## Start all services (dev mode with hot-reload)
	$(COMPOSE) up -d

up-prod:  ## Start all services (production build)
	$(COMPOSE) -f docker-compose.yml up -d

down:  ## Stop all services
	$(COMPOSE) down

build:  ## Rebuild all images
	$(COMPOSE) build

restart: down up  ## Restart all services

logs:  ## Follow logs for all services
	$(COMPOSE) logs -f

logs-api:  ## Follow API logs
	$(COMPOSE) logs -f api

logs-worker:  ## Follow Celery worker logs
	$(COMPOSE) logs -f celery-worker

# ─── Database / Alembic ───────────────────────────────────────────────────────
migrate:  ## Run database migrations
	$(COMPOSE) exec api alembic upgrade head

migrate-create:  ## Create new migration: make migrate-create MSG="add users table"
	$(COMPOSE) exec api alembic revision --autogenerate -m "$(MSG)"

migrate-down:  ## Rollback last migration
	$(COMPOSE) exec api alembic downgrade -1

migrate-history:  ## Show migration history
	$(COMPOSE) exec api alembic history

db-shell:  ## Open psql shell
	$(COMPOSE) exec postgres psql -U his_ris_user -d his_ris

# ─── Backend ──────────────────────────────────────────────────────────────────
shell:  ## Open bash shell in API container
	$(COMPOSE) exec api bash

test:  ## Run backend tests
	$(COMPOSE) exec api pytest tests/ -v --tb=short

test-cov:  ## Run tests with coverage
	$(COMPOSE) exec api pytest tests/ -v --cov=app --cov-report=html

lint:  ## Run ruff linter
	$(COMPOSE) exec api ruff check app/ --fix

format:  ## Run ruff formatter
	$(COMPOSE) exec api ruff format app/

# ─── Frontend ─────────────────────────────────────────────────────────────────
fe-install:  ## Install frontend dependencies
	$(COMPOSE) exec frontend npm install

fe-test:  ## Run frontend tests
	$(COMPOSE) exec frontend npm test

fe-build:  ## Build frontend for production
	$(COMPOSE) exec frontend npm run build

# ─── Keys ─────────────────────────────────────────────────────────────────────
keys:  ## Generate RS256 JWT key pair
	@mkdir -p infrastructure/keys
	openssl genrsa -out infrastructure/keys/private_key.pem 2048
	openssl rsa -in infrastructure/keys/private_key.pem -pubout -out infrastructure/keys/public_key.pem
	@echo "Keys generated in infrastructure/keys/"

# ─── Seed ─────────────────────────────────────────────────────────────────────
seed:  ## Seed database with initial data
	$(COMPOSE) exec api python -m app.db.seed

seed-demo:  ## Seed database with demo data
	$(COMPOSE) exec api python -m app.db.seed_demo

# ─── Health ───────────────────────────────────────────────────────────────────
health:  ## Check health of all services
	@echo "=== API ===" && curl -s http://localhost:8000/health | python3 -m json.tool
	@echo "=== Orthanc ===" && curl -s http://localhost:8042/system | python3 -m json.tool

# ─── Clean ────────────────────────────────────────────────────────────────────
clean:  ## Remove containers and volumes (DESTRUCTIVE)
	$(COMPOSE) down -v --remove-orphans

clean-images:  ## Remove built images
	$(COMPOSE) down --rmi local
