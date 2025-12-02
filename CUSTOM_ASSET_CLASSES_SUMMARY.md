# Ghostfolio Custom Asset Classes - Complete Implementation Guide

## Overview

This document summarizes all customizations made to add custom Asset Classes and Sub-Classes to Ghostfolio.

**Date:** December 2, 2025  
**Docker Image:** `kalmanoharan/ghostfolio:custom`  
**Docker Hub:** https://hub.docker.com/r/kalmanoharan/ghostfolio

---

## New Enums Added

### Asset Classes (2 new)
| Enum Value | Display Name |
|------------|--------------|
| `DEBT` | Debt |
| `PRECIOUS_METALS` | Precious Metals |

### Asset Sub-Classes (9 new)
| Enum Value | Display Name |
|------------|--------------|
| `COMMODITY` | Commodity |
| `DEBT_FUND` | Debt Fund |
| `FIXED_DEPOSIT` | Fixed Deposit |
| `GOLD_22K` | Gold 22K |
| `GOLD_24K` | Gold 24K |
| `GOLD_ETF` | Gold ETF |
| `HOUSE` | House |
| `PLOT` | Plot |
| `SILVER_BAR` | Silver Bar |

---

## Asset Class → Sub-Class Mappings

| Asset Class | Sub-Classes |
|-------------|-------------|
| `PRECIOUS_METALS` | GOLD_22K, GOLD_24K, GOLD_ETF, SILVER_BAR |
| `DEBT` | BOND, DEBT_FUND, FIXED_DEPOSIT |
| `REAL_ESTATE` | HOUSE, PLOT |
| `COMMODITY` | COMMODITY, PRECIOUS_METAL |
| `LIQUIDITY` | CASH, CRYPTOCURRENCY |
| `EQUITY` | ETF, MUTUALFUND, PRIVATE_EQUITY, STOCK |
| `FIXED_INCOME` | BOND |
| `ALTERNATIVE_INVESTMENT` | COLLECTIBLE |

---

## Files Modified

### 1. `prisma/schema.prisma`
Added new enum values to `AssetClass` and `AssetSubClass` enums.

```prisma
enum AssetClass {
  ALTERNATIVE_INVESTMENT
  COMMODITY
  DEBT                    // NEW
  EQUITY
  FIXED_INCOME
  LIQUIDITY
  PRECIOUS_METALS         // NEW
  REAL_ESTATE
}

enum AssetSubClass {
  BOND
  CASH
  COLLECTIBLE
  COMMODITY               // NEW
  CRYPTOCURRENCY
  DEBT_FUND               // NEW
  ETF
  FIXED_DEPOSIT           // NEW
  GOLD_22K                // NEW
  GOLD_24K                // NEW
  GOLD_ETF                // NEW
  HOUSE                   // NEW
  MUTUALFUND
  PLOT                    // NEW
  PRECIOUS_METAL
  PRIVATE_EQUITY
  SILVER_BAR              // NEW
  STOCK
}
```

### 2. `libs/common/src/lib/config.ts`
Updated `ASSET_CLASS_MAPPING` (around line 37):

```typescript
export const ASSET_CLASS_MAPPING = new Map<AssetClass, AssetSubClass[]>([
  [AssetClass.ALTERNATIVE_INVESTMENT, [AssetSubClass.COLLECTIBLE]],
  [AssetClass.COMMODITY, [AssetSubClass.COMMODITY, AssetSubClass.PRECIOUS_METAL]],
  [
    AssetClass.DEBT,
    [AssetSubClass.BOND, AssetSubClass.DEBT_FUND, AssetSubClass.FIXED_DEPOSIT]
  ],
  [
    AssetClass.EQUITY,
    [
      AssetSubClass.ETF,
      AssetSubClass.MUTUALFUND,
      AssetSubClass.PRIVATE_EQUITY,
      AssetSubClass.STOCK
    ]
  ],
  [AssetClass.FIXED_INCOME, [AssetSubClass.BOND]],
  [AssetClass.LIQUIDITY, [AssetSubClass.CASH, AssetSubClass.CRYPTOCURRENCY]],
  [
    AssetClass.PRECIOUS_METALS,
    [
      AssetSubClass.GOLD_22K,
      AssetSubClass.GOLD_24K,
      AssetSubClass.GOLD_ETF,
      AssetSubClass.SILVER_BAR
    ]
  ],
  [AssetClass.REAL_ESTATE, [AssetSubClass.HOUSE, AssetSubClass.PLOT]]
]);
```

### 3. `libs/ui/src/lib/i18n.ts`
Added translations for all new enum values (around line 45):

```typescript
// AssetClass (enum)
ALTERNATIVE_INVESTMENT: $localize`Alternative Investment`,
COMMODITY: $localize`Commodity`,
DEBT: $localize`Debt`,
EQUITY: $localize`Equity`,
FIXED_INCOME: $localize`Fixed Income`,
LIQUIDITY: $localize`Liquidity`,
PRECIOUS_METALS: $localize`Precious Metals`,
REAL_ESTATE: $localize`Real Estate`,

// AssetSubClass (enum)
BOND: $localize`Bond`,
CASH: $localize`Cash`,
COLLECTIBLE: $localize`Collectible`,
// COMMODITY already defined above in AssetClass
CRYPTOCURRENCY: $localize`Cryptocurrency`,
DEBT_FUND: $localize`Debt Fund`,
ETF: $localize`ETF`,
FIXED_DEPOSIT: $localize`Fixed Deposit`,
GOLD_22K: $localize`Gold 22K`,
GOLD_24K: $localize`Gold 24K`,
GOLD_ETF: $localize`Gold ETF`,
HOUSE: $localize`House`,
MUTUALFUND: $localize`Mutual Fund`,
PLOT: $localize`Plot`,
PRECIOUS_METAL: $localize`Precious Metal`,
PRIVATE_EQUITY: $localize`Private Equity`,
SILVER_BAR: $localize`Silver Bar`,
STOCK: $localize`Stock`,
```

**Note:** `COMMODITY` appears in both AssetClass and AssetSubClass but only needs ONE entry in i18n.ts (duplicate keys cause build errors).

### 4. `prisma/migrations/20241202000000_added_custom_asset_classes_and_sub_classes/migration.sql`

```sql
-- Add new Asset Classes
ALTER TYPE "AssetClass" ADD VALUE 'DEBT';
ALTER TYPE "AssetClass" ADD VALUE 'PRECIOUS_METALS';

-- Add new Asset Sub-Classes
ALTER TYPE "AssetSubClass" ADD VALUE 'COMMODITY';
ALTER TYPE "AssetSubClass" ADD VALUE 'DEBT_FUND';
ALTER TYPE "AssetSubClass" ADD VALUE 'FIXED_DEPOSIT';
ALTER TYPE "AssetSubClass" ADD VALUE 'GOLD_22K';
ALTER TYPE "AssetSubClass" ADD VALUE 'GOLD_24K';
ALTER TYPE "AssetSubClass" ADD VALUE 'GOLD_ETF';
ALTER TYPE "AssetSubClass" ADD VALUE 'HOUSE';
ALTER TYPE "AssetSubClass" ADD VALUE 'PLOT';
ALTER TYPE "AssetSubClass" ADD VALUE 'SILVER_BAR';
```

### 5. `.github/workflows/docker-build.yml`
GitHub Actions workflow to automatically build and push Docker image:

```yaml
name: Build and Push Custom Ghostfolio Image

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: docker.io
  IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/ghostfolio

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:custom
            ${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Git Commits

```
f6422775 - fix: Remove duplicate COMMODITY key in i18n.ts
a05ac341 - docs: Add custom asset classes implementation summary
d56c0a63 - ci: Add GitHub Actions workflow for Docker build
38ae05b3 - feat: Add custom Asset Classes and Sub-Classes
```

---

## GitHub Secrets Required

Add these in: **GitHub Repo → Settings → Secrets and variables → Actions**

| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |

Create Docker Hub token at: https://hub.docker.com/settings/security

---

## Deployment on OMV/Portainer

### Docker Compose Configuration

```yaml
services:
  ghostfolio:
    image: kalmanoharan/ghostfolio:custom
    container_name: ghostfolio
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/ghostfolio-db
      REDIS_HOST: redis
      # ... other env vars
    ports:
      - "3333:3333"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    container_name: gf-postgres
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ghostfolio-db
    volumes:
      - postgres:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    container_name: gf-redis

volumes:
  postgres:
```

---

## Database Migration (Manual Fix)

If Prisma migration fails with "enum label already exists", run these commands:

### Connect to PostgreSQL
```bash
docker exec -it gf-postgres psql -U user -d ghostfolio-db
```

### Fix Failed Migration
```sql
-- Delete failed migration record
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20241202000000_added_custom_asset_classes_and_sub_classes';

-- Add enum values (IF NOT EXISTS skips duplicates)
ALTER TYPE "AssetClass" ADD VALUE IF NOT EXISTS 'DEBT';
ALTER TYPE "AssetClass" ADD VALUE IF NOT EXISTS 'PRECIOUS_METALS';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'COMMODITY';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'DEBT_FUND';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'FIXED_DEPOSIT';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'GOLD_22K';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'GOLD_24K';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'GOLD_ETF';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'HOUSE';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'PLOT';
ALTER TYPE "AssetSubClass" ADD VALUE IF NOT EXISTS 'SILVER_BAR';

-- Mark migration as complete
INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual_fix',
  '20241202000000_added_custom_asset_classes_and_sub_classes',
  NULL,
  NOW(),
  NOW(),
  1
);

-- Exit
\q
```

Then restart Ghostfolio container.

---

## Versioning Scheme

Your custom builds use semantic versioning: `v{MAJOR}.{MINOR}.{PATCH}`

| Version Part | When to Increment |
|--------------|-------------------|
| **MAJOR** | Breaking changes, major new features |
| **MINOR** | New features (like new asset classes) |
| **PATCH** | Bug fixes, small improvements |

### Current Version
Check `VERSION` file in repo root: **v1.0.0** (Custom Asset Classes)

### Version History
| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | Dec 2, 2025 | Added DEBT, PRECIOUS_METALS asset classes and sub-classes |

---

## Future Updates Workflow

### Option A: Development Build (push to main)
Creates tags: `dev`, `custom`

```bash
git add .
git commit -m "description of changes"
git push origin main
```

### Option B: Release Version (recommended for production)
Creates tags: `v1.0.0`, `v1.0`, `v1`, `custom`, `latest`

```bash
# 1. Update VERSION file
echo "1.1.0" > VERSION

# 2. Commit your changes
git add .
git commit -m "feat: Add new feature X"

# 3. Create a version tag
git tag v1.1.0

# 4. Push both commit and tag
git push origin main
git push origin v1.1.0
```

### Option C: Manual Trigger
1. Go to GitHub → Actions → "Build and Push Custom Ghostfolio Image"
2. Click "Run workflow"
3. Optionally enter a version tag
4. Click "Run workflow"

---

## Docker Image Tags

| Tag | Description | Use Case |
|-----|-------------|----------|
| `v1.0.0` | Specific version | Production (recommended) |
| `v1.0` | Latest patch of v1.0.x | Production |
| `v1` | Latest minor of v1.x.x | Rolling updates |
| `latest` | Latest tagged release | Always newest stable |
| `custom` | Always present | Generic reference |
| `dev` | Latest main branch | Testing new features |

### In Docker Compose
```yaml
# For stable production
image: kalmanoharan/ghostfolio:v1.0.0

# For auto-updates within minor version
image: kalmanoharan/ghostfolio:v1.0

# For latest features (may have bugs)
image: kalmanoharan/ghostfolio:dev
```

---

## Deployment Steps

1. **Wait for GitHub Actions** to build (~15-20 min)
2. **On OMV/Portainer:** Pull & redeploy the stack
3. **Run migrations** if schema changed

---

## Troubleshooting

### Build fails with duplicate key error
- Check `libs/ui/src/lib/i18n.ts` for duplicate keys
- `COMMODITY` exists in both AssetClass and AssetSubClass - only define once!

### Migration fails with "enum label already exists"  
- The enum was already added in a previous attempt
- Follow the "Database Migration (Manual Fix)" section above

### Docker build fails locally (Rancher Desktop)
- Use GitHub Actions instead - more reliable for heavy builds
- Or try Docker Desktop instead of Rancher Desktop

### Can't see new Asset Classes in UI
- Clear browser cache
- Verify translations exist in `i18n.ts`
- Check browser console for errors

---

## File Locations Quick Reference

| Purpose | File Path |
|---------|-----------|
| Database Schema | `prisma/schema.prisma` |
| Class→SubClass Mapping | `libs/common/src/lib/config.ts` |
| Translations | `libs/ui/src/lib/i18n.ts` |
| DB Migration | `prisma/migrations/20241202000000_.../migration.sql` |
| GitHub Actions | `.github/workflows/docker-build.yml` |
| Docker Compose (dev) | `docker/docker-compose.yml` |

---

## Current Setup

- **App Container:** ghostfolio
- **PostgreSQL:** gf-postgres (postgres:15-alpine)
- **Redis:** gf-redis (redis:alpine)
- **Database:** ghostfolio-db
- **DB User:** user
- **Image:** kalmanoharan/ghostfolio:custom
