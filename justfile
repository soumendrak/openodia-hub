# OpenOdia Hub — task runner
# Requires: just (https://just.systems), bun, wrangler

# List all available recipes
default:
    @just --list

# Install dependencies
install:
    bun install

# Start the development server
dev:
    bun run dev

# Production build
build:
    bun run build

# Development-mode build
build-dev:
    bun run build:dev

# Preview the production build locally
preview:
    bun run preview

# Run ESLint
lint:
    bun run lint

# Fix auto-fixable lint issues
lint-fix:
    bun run lint --fix

# Format source files with Prettier
format:
    bun run format

# Run tests once
test:
    bun run test

# Run tests in watch mode
test-watch:
    bun run test:watch

# Run lint + tests (CI gate)
check: lint test

# Deploy to Cloudflare Workers (requires Cloudflare credentials)
deploy:
    bun run build
    npx wrangler deploy

# Remove build artefacts
clean:
    rm -rf dist .wrangler
