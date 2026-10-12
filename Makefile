# Buzzwire developer commands. Run `make help` for the list.

-include .env

PB_VERSION   := $(shell sed -n 's/^ARG PB_VERSION=//p' docker/Dockerfile)
PB_BIN       := .pb/pocketbase
IMAGE        ?= $(or $(BUZZWIRE_IMAGE),ghcr.io/danish12196/buzzwire)
TAG          ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
# The Synology DS923+ is x86_64.
PLATFORM     ?= linux/amd64

UNAME_S := $(shell uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M := $(shell uname -m)
PB_ARCH := $(if $(filter $(UNAME_M),arm64 aarch64),arm64,amd64)

PB_SERVE := $(PB_BIN) serve --http=127.0.0.1:8090 --dir=pb_data --publicDir=dist \
	--hooksDir=pb_hooks --migrationsDir=pb_migrations

.PHONY: help install dev dev-pb dev-web check build image smoke push up down logs clean

help: ## Show this help
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

install: node_modules $(PB_BIN) ## Install npm deps and download PocketBase

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

$(PB_BIN): docker/Dockerfile
	@echo "Downloading PocketBase $(PB_VERSION) ($(UNAME_S)/$(PB_ARCH))"
	@mkdir -p .pb
	curl -fsSL -o .pb/pb.zip \
		https://github.com/pocketbase/pocketbase/releases/download/v$(PB_VERSION)/pocketbase_$(PB_VERSION)_$(UNAME_S)_$(PB_ARCH).zip
	unzip -oq .pb/pb.zip pocketbase -d .pb && rm .pb/pb.zip
	@touch $(PB_BIN)

dev: install ## Run PocketBase (:8090) and Vite (:5173) together
	@trap 'kill 0' INT TERM EXIT; $(PB_SERVE) & npm run dev

dev-pb: $(PB_BIN) ## Run only PocketBase on :8090
	$(PB_SERVE)

dev-web: node_modules ## Run only Vite on :5173 (proxies /api to :8090)
	npm run dev

check: node_modules ## Typecheck, lint, format check and unit tests
	npm run typecheck
	npm run lint
	npm run format:check
	npm test

build: node_modules ## Build the React app into dist/
	npm run build

image: ## Build the Docker image for this machine
	docker build -f docker/Dockerfile -t $(IMAGE):$(TAG) -t $(IMAGE):latest .

smoke: image ## Build the image, start it, and check it responds
	tests/smoke.sh $(IMAGE):$(TAG)

push: ## Build for the NAS (linux/amd64) and push to the registry
	docker buildx build --platform $(PLATFORM) -f docker/Dockerfile \
		-t $(IMAGE):$(TAG) -t $(IMAGE):latest --push .

up: ## Start the production stack locally with docker compose
	docker compose up -d --build

down: ## Stop the docker compose stack
	docker compose down

logs: ## Follow the container logs
	docker compose logs -f

clean: ## Remove build output (keeps pb_data)
	rm -rf dist node_modules/.tmp
