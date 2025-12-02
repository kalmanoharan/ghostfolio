# Ghostfolio Custom Asset Classes - Work Summary

## ✅ Completed Changes

### Files Modified:

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added new AssetClass and AssetSubClass enums |
| `libs/common/src/lib/config.ts` | Updated ASSET_CLASS_MAPPING |
| `libs/ui/src/lib/i18n.ts` | Added translations |
| `prisma/migrations/20241202000000_.../migration.sql` | Database migration |
| `docker/docker-compose.custom.yml` | Custom Docker Compose |
| `.github/workflows/docker-build.yml` | GitHub Actions for automated builds |

### New Enums Added:

**AssetClass:**
- `DEBT`
- `PRECIOUS_METALS`

**AssetSubClass:**
- `COMMODITY`, `DEBT_FUND`, `FIXED_DEPOSIT`
- `GOLD_22K`, `GOLD_24K`, `GOLD_ETF`, `SILVER_BAR`
- `HOUSE`, `PLOT`

### Asset Class Mappings (in `config.ts`):

```typescript
PRECIOUS_METALS → [GOLD_22K, GOLD_24K, GOLD_ETF, SILVER_BAR]
DEBT → [BOND, DEBT_FUND, FIXED_DEPOSIT]
LIQUIDITY → [CASH, CRYPTOCURRENCY]
REAL_ESTATE → [HOUSE, PLOT]
COMMODITY → [COMMODITY, PRECIOUS_METAL]
FIXED_INCOME → [BOND]
```

### Git Commits:
```
38ae05b3 - feat: Add custom Asset Classes and Sub-Classes
d56c0a63 - ci: Add GitHub Actions workflow for Docker build
```

---

## 🔄 Pending Steps

### Step 1: Push to GitHub
```bash
cd /Users/kalmanoharan/Documents/ghostfolio
git push origin main
```

### Step 2: Set up GitHub Secrets
Go to: **GitHub repo → Settings → Secrets and variables → Actions**

Add these secrets:
| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token (from https://hub.docker.com/settings/security) |

### Step 3: Wait for GitHub Action
- Go to **Actions** tab in your GitHub repo
- Wait for "Build and Push Custom Ghostfolio Image" to complete (~15-20 min)
- Image will be pushed to: `docker.io/kalmanoharan/ghostfolio:custom`

### Step 4: Update OMV/Portainer

**4a. Update docker-compose.yml in Portainer:**
```yaml
services:
  ghostfolio:
    image: docker.io/kalmanoharan/ghostfolio:custom
    # ... rest stays the same
```

**4b. Run Database Migration (via Portainer console or SSH):**
```bash
docker exec -it gf-postgres psql -U user -d ghostfolio-db -c "
ALTER TYPE \"AssetClass\" ADD VALUE 'DEBT';
ALTER TYPE \"AssetClass\" ADD VALUE 'PRECIOUS_METALS';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'COMMODITY';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'DEBT_FUND';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'FIXED_DEPOSIT';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'GOLD_22K';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'GOLD_24K';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'GOLD_ETF';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'HOUSE';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'PLOT';
ALTER TYPE \"AssetSubClass\" ADD VALUE 'SILVER_BAR';
"
```

**4c. Redeploy the stack in Portainer**

---

## 📁 Key File Locations

| Purpose | File Path | Line # |
|---------|-----------|--------|
| Database Schema | `prisma/schema.prisma` | ~295 |
| Class→SubClass Mapping | `libs/common/src/lib/config.ts` | ~37 |
| Translations | `libs/ui/src/lib/i18n.ts` | ~45 |
| DB Migration | `prisma/migrations/20241202000000_added_custom_asset_classes_and_sub_classes/migration.sql` | - |
| GitHub Actions | `.github/workflows/docker-build.yml` | - |
| Custom Docker Compose | `docker/docker-compose.custom.yml` | - |

---

## 🔧 Current OMV Setup

- **App Container:** ghostfolio
- **PostgreSQL:** gf-postgres (postgres:15-alpine)
- **Redis:** gf-redis (redis:alpine)
- **DB Name:** ghostfolio-db
- **DB User:** user

---

## 🚀 Future Updates

When Ghostfolio releases updates:
1. Pull upstream changes: `git fetch upstream && git merge upstream/main`
2. Resolve conflicts in modified files
3. Push to trigger GitHub Action rebuild
4. Update and redeploy on OMV

