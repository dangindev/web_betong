.PHONY: up down logs backend-test frontend-test test migrate seed fmt lint typecheck

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

backend-test:
	PYTHONPATH=/root/web_betong/backend python3 -m pytest /root/web_betong/backend/tests/test_suite.py

frontend-test:
	npm --prefix /root/web_betong/frontend run test

test: backend-test frontend-test

migrate:
	PYTHONPATH=/root/web_betong/backend alembic -c /root/web_betong/backend/alembic.ini upgrade head

seed:
	PYTHONPATH=/root/web_betong/backend python3 /root/web_betong/scripts/seed.py

fmt:
	black /root/web_betong/backend && npm --prefix /root/web_betong/frontend run lint -- --fix

lint:
	ruff check /root/web_betong/backend && npm --prefix /root/web_betong/frontend run lint

typecheck:
	mypy /root/web_betong/backend && npm --prefix /root/web_betong/frontend run typecheck
