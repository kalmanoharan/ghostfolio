# Ghostfolio Custom Fork - Complete Guide

## Overview

This is a customized fork of [Ghostfolio](https://github.com/ghostfolio/ghostfolio) with additional features and asset classes for personal wealth management.

**Maintainer:** kalmanoharan  
**Docker Hub:** https://hub.docker.com/r/kalmanoharan/ghostfolio  
**Current Version:** v1.2.0

---

## Table of Contents

1. [Version History](#version-history)
2. [Custom Features](#custom-features)
3. [Custom Asset Classes](#custom-asset-classes)
4. [Installation & Deployment](#installation--deployment)
5. [Development Workflow](#development-workflow)
6. [Troubleshooting](#troubleshooting)
7. [File Reference](#file-reference)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v1.2.0** | Dec 2, 2025 | Tag edit bug fix, Activities search feature |
| v1.1.0 | Dec 2, 2025 | Semantic versioning for Docker builds |
| v1.0.0 | Dec 2, 2025 | Custom asset classes (DEBT, PRECIOUS_METALS) |

---

## Custom Features

### Feature 1: Tag Edit Bug Fix (v1.2.0)

**Problem:** When editing an existing activity and only adding/changing a tag, the "Save" button remained disabled.

**Solution:** The tags selector component now properly marks the form control as dirty when tags are modified.

**Files Modified:**
- `libs/ui/src/lib/tags-selector/tags-selector.component.ts`

**Key Changes:**
```typescript
// Inject NgControl to access parent form control
constructor(@Optional() @Self() private ngControl: NgControl) {
  if (this.ngControl) {
    this.ngControl.valueAccessor = this;
  }
}

// Mark form as dirty when tags change
private markAsDirty(): void {
  this.ngControl?.control?.markAsDirty();
}
```

---

### Feature 2: Activities Page Search (v1.2.0)

**Problem:** No way to quickly search/filter activities directly on the Activities page.

**Solution:** Added a search box that filters activities by symbol, name, account, or type. Works alongside existing Assistant filters.

**Files Modified:**
- `apps/client/src/app/pages/portfolio/activities/activities-page.component.ts`
- `apps/client/src/app/pages/portfolio/activities/activities-page.html`
- `apps/client/src/app/pages/portfolio/activities/activities-page.scss`

**How to Use:**
1. Go to Portfolio → Activities
2. Use the search box at the top of the page
3. Type to filter by symbol (AAPL), name, account, or activity type (BUY, SELL, etc.)
4. Click X to clear the search
5. Search combines with Assistant filters (both are applied)

**Key Changes:**
```typescript
// Search control with debouncing
public searchControl = new FormControl('');

this.searchControl.valueChanges
  .pipe(debounceTime(300), distinctUntilChanged())
  .subscribe(() => {
    this.pageIndex = 0;
    this.fetchActivities();
  });

// Merge search with Assistant filters
fetchActivities() {
  const filters: Filter[] = [...this.userService.getFilters()];
  const searchTerm = this.searchControl.value?.trim();
  if (searchTerm) {
    filters.push({ id: searchTerm, type: 'SEARCH_QUERY' });
  }
  // ... fetch with filters
}
```

---

## Custom Asset Classes

### New Asset Classes (v1.0.0)

| Enum Value | Display Name | Use Case |
|------------|--------------|----------|
| `DEBT` | Debt | FDs, debt funds, bonds |
| `PRECIOUS_METALS` | Precious Metals | Physical gold, silver, gold ETFs |

### New Asset Sub-Classes (v1.0.0)

| Enum Value | Display Name | Parent Class |
|------------|--------------|--------------|
| `GOLD_ETF` | Gold ETF | PRECIOUS_METALS |
| `GOLD_24K` | Gold 24K | PRECIOUS_METALS |
| `GOLD_22K` | Gold 22K | PRECIOUS_METALS |
| `SILVER_BAR` | Silver Bar | PRECIOUS_METALS |
| `FIXED_DEPOSIT` | Fixed Deposit | DEBT |
| `DEBT_FUND` | Debt Fund | DEBT |
| `HOUSE` | House | REAL_ESTATE |
| `PLOT` | Plot | REAL_ESTATE |
| `COMMODITY` | Commodity | COMMODITY |

### Asset Class → Sub-Class Mappings

```typescript
PRECIOUS_METALS → [GOLD_22K, GOLD_24K, GOLD_ETF, SILVER_BAR]
DEBT → [BOND, DEBT_FUND, FIXED_DEPOSIT]
REAL_ESTATE → [HOUSE, PLOT]
COMMODITY → [COMMODITY, PRECIOUS_METAL]
LIQUIDITY → [CASH, CRYPTOCURRENCY]
EQUITY → [ETF, MUTUALFUND, PRIVATE_EQUITY, STOCK]
FIXED_INCOME → [BOND]
ALTERNATIVE_INVESTMENT → [COLLECTIBLE]
```

---

## Installation & Deployment

### Prerequisites

- Docker & Docker Compose
- GitHub account (for forking)
- Docker Hub account (for image hosting)

### GitHub Secrets Setup

Add these secrets in: **GitHub Repo → Settings → Secrets and variables → Actions**

| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |

Create Docker Hub token at: https://hub.docker.com/settings/security

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  ghostfolio:
    image: kalmanoharan/ghostfolio:v1.2.0
    container_name: ghostfolio
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ghostfolio:password@postgres:5432/ghostfolio-db
      REDIS_HOST: redis
      REDIS_PORT: 6379
      ACCESS_TOKEN_SALT: your-random-salt-here
      JWT_SECRET_KEY: your-jwt-secret-here
    ports:
      - "3333:3333"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    container_name: gf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ghostfolio
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ghostfolio-db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    container_name: gf-redis
    restart: unless-stopped

volumes:
  postgres_data:
```

### First-Time Database Setup

If you have a fresh database, the migrations will run automatically on container start.

### Upgrading from Previous Version

1. Pull the new image:
   ```bash
   docker pull kalmanoharan/ghostfolio:v1.2.0
   ```

2. Update your docker-compose.yml with the new version

3. Restart the stack:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. Migrations run automatically on startup

---

## Development Workflow

### Local Development

```bash
# Clone the repo
git clone https://github.com/kalmanoharan/ghostfolio.git
cd ghostfolio

# Install dependencies
npm install

# Start development servers
nx serve api      # Backend on http://localhost:3333
nx serve client   # Frontend on http://localhost:4200
```

### Making Changes

1. **Edit code** in your local fork
2. **Test locally** using `nx serve`
3. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat: Your feature description"
   ```

### Release Process

#### Development Build (push to main)
Creates tags: `dev`, `custom`

```bash
git push origin main
```

#### Production Release (recommended)
Creates tags: `v1.2.0`, `v1.2`, `v1`, `latest`, `custom`

```bash
# 1. Update VERSION file
echo "1.3.0" > VERSION

# 2. Commit changes
git add .
git commit -m "feat: Description of changes"

# 3. Create version tag
git tag v1.3.0

# 4. Push everything
git push origin main
git push origin v1.3.0
```

### Docker Image Tags

| Tag | Description | Stability |
|-----|-------------|-----------|
| `v1.2.0` | Exact version | Most stable |
| `v1.2` | Latest v1.2.x patch | Stable |
| `v1` | Latest v1.x.x | Rolling |
| `latest` | Latest release | Current |
| `dev` | Latest main branch | Experimental |
| `custom` | Always present | Reference |

---

## Troubleshooting

### Build Fails with Duplicate Key Error

**Symptom:** TypeScript error about duplicate object keys in `i18n.ts`

**Solution:** `COMMODITY` exists in both AssetClass and AssetSubClass - only define once in translations.

### Migration Fails with "enum label already exists"

**Symptom:** Prisma error `P3009` with message `enum label "DEBT" already exists`

**Solution:**
```bash
# Connect to PostgreSQL
docker exec -it gf-postgres psql -U ghostfolio -d ghostfolio-db

# Fix the migration
DELETE FROM "_prisma_migrations" 
WHERE migration_name LIKE '%custom_asset_classes%';

# Add enums manually (IF NOT EXISTS prevents errors)
ALTER TYPE "AssetClass" ADD VALUE IF NOT EXISTS 'DEBT';
ALTER TYPE "AssetClass" ADD VALUE IF NOT EXISTS 'PRECIOUS_METALS';
-- ... add other enums

# Mark as complete
INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
VALUES (gen_random_uuid()::text, 'manual', '20241202000000_added_custom_asset_classes_and_sub_classes', NOW(), NOW(), 1);

\q
```

### Can't See Edit Button on Activities

**Cause:** The Edit button is in a context menu (three dots ⋯)

**Solution:**
1. Look for ⋯ in the Actions column (right side of each row)
2. Click to open the menu
3. Select "Edit..."

**Note:** Menu only appears if you have delete permission and aren't in restricted view.

### Search Not Working

**Symptom:** Activities search returns no results

**Checklist:**
- Search is case-insensitive
- Search works on: symbol, name, account name, activity type
- Clear browser cache
- Check browser console for errors

### Docker Build Fails Locally

**Cause:** Rancher Desktop resource limits

**Solution:** Use GitHub Actions instead (more reliable for heavy builds)

---

## File Reference

### Core Files Modified

| Purpose | File Path |
|---------|-----------|
| Database Schema | `prisma/schema.prisma` |
| Asset Mappings | `libs/common/src/lib/config.ts` |
| Translations | `libs/ui/src/lib/i18n.ts` |
| Tags Selector | `libs/ui/src/lib/tags-selector/tags-selector.component.ts` |
| Activities Page | `apps/client/src/app/pages/portfolio/activities/activities-page.*` |
| GitHub Actions | `.github/workflows/docker-build.yml` |
| Version | `VERSION` |

### Key Directories

```
ghostfolio/
├── apps/
│   ├── api/              # NestJS backend
│   └── client/           # Angular frontend
├── libs/
│   ├── common/           # Shared types, config
│   └── ui/               # Reusable UI components
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── .github/workflows/    # CI/CD pipelines
├── VERSION               # Current version
└── CUSTOMIZATION_GUIDE.md  # This file
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## License

This fork maintains the same license as the original Ghostfolio project (AGPL-3.0).

