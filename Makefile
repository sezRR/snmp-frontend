COMPOSE ?= docker compose

up-prod:
	$(COMPOSE) --profile production up --build -d frontend-prod