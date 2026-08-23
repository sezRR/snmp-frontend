COMPOSE ?= docker compose

up-prod:
	$(COMPOSE) --profile production up --build -d frontend-prod

down-prod:
	$(COMPOSE) --profile production down --remove-orphans

restart-prod:
	$(COMPOSE) --profile production restart frontend-prod