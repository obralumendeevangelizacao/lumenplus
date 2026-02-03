.PHONY: install lint format typecheck test migrate run dev

install:
	pip install -e ".[dev]"

lint:
	ruff check .

format:
	ruff format .

typecheck:
	mypy app

test:
	pytest -v

migrate:
	alembic upgrade head

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev: migrate run

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api

docker-migrate:
	docker compose exec api alembic upgrade head

docker-seed:
	@echo "Run: curl -X POST http://localhost:8000/dev/seed -H 'Authorization: Bearer dev:admin:admin@example.com'"
