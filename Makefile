.PHONY: post serve build clean help

# Get current date in YYYY-MM-DD format
DATE := $(shell date +%Y-%m-%d)

# Default post slug if none provided
SLUG ?= new-post

# Post template location
TEMPLATE := docs/_posts/2025-01-01-example-template.md

# Target post location
POST_DIR := docs/_posts

help:
	@echo "Available commands:"
	@echo "  make post SLUG=my-post-title    - Create a new post (default: new-post)"
	@echo "  make serve                      - Serve the site locally"
	@echo "  make build                      - Build the site"
	@echo "  make clean                      - Clean build artifacts"
	@echo ""
	@echo "Examples:"
	@echo "  make post SLUG=probability-chapter-2"
	@echo "  make post SLUG=machine-learning-intro"

post:
	@if [ ! -f $(TEMPLATE) ]; then \
		echo "Error: Template not found at $(TEMPLATE)"; \
		exit 1; \
	fi
	@POST_FILE="$(POST_DIR)/$(DATE)-$(SLUG).md"; \
	if [ -f "$$POST_FILE" ]; then \
		echo "Error: Post already exists at $$POST_FILE"; \
		exit 1; \
	fi; \
	cp $(TEMPLATE) "$$POST_FILE"; \
	sed -i "s/date: 2025-01-01 10:00:00 -0500/date: $(DATE) $(shell date +%H:%M:%S) -0500/" "$$POST_FILE"; \
	echo "Created new post: $$POST_FILE"; \
	echo "Edit it to add your content!"

serve:
	@echo "Starting Jekyll server..."
	@cd docs && bundle exec jekyll serve --livereload

build:
	@echo "Building Jekyll site..."
	@cd docs && bundle exec jekyll build

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf docs/_site docs/.jekyll-cache
	@echo "Clean complete!"

# Default target
.DEFAULT_GOAL := help
