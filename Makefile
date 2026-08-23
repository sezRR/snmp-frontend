COMPOSE ?= docker compose

up-prod:
	$(COMPOSE) --profile production up --build -d frontend-prod

down-prod:
	$(COMPOSE) --profile production down --remove-orphans

restart-prod:
	$(COMPOSE) --profile production restart frontend-prod

clean-prod:
	$(COMPOSE) --profile production down --remove-orphans
	$(COMPOSE) --profile production rm -f frontend-prod

build-prod:
	$(COMPOSE) --profile production build frontend-prod