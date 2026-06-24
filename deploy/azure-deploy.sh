#!/usr/bin/env bash
# Azure deployment script for Omi.
# Idempotent — safe to re-run. Resumes/updates instead of erroring on existing resources.
#
# Prereqs:
#   - az CLI installed and `az login` completed
#   - Public Docker image at $IMAGE (default: ghcr.io/dihass/omigame:latest)
#
# What it creates:
#   1. Resource group
#   2. Container Apps environment
#   3. Azure Cache for Redis (Basic C0) — persistent, $16/mo
#   4. Container App for the API — 1 always-on replica, max 3
#   5. Outputs the backend URL for use in Static Web Apps linking

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
RG="${RG:-omi-rg}"
LOCATION="${LOCATION:-eastus}"
ENV_NAME="${ENV_NAME:-omi-env}"
REDIS_NAME="${REDIS_NAME:-omi-redis-$RANDOM}"  # globally unique — append random
API_NAME="${API_NAME:-omi-api}"
IMAGE="${IMAGE:-ghcr.io/dihass/omigame:latest}"

# Generate a 64-byte random JWT signing key (override via env if you have one)
JWT_KEY="${JWT_KEY:-$(openssl rand -base64 64 | tr -d '\n')}"

# Will be overwritten after first SWA deploy with the real URL
CORS_ORIGIN="${CORS_ORIGIN:-https://localhost}"

echo "── Deploying Omi to Azure ─────────────────────────"
echo "Resource group:  $RG"
echo "Location:        $LOCATION"
echo "Redis name:      $REDIS_NAME"
echo "API name:        $API_NAME"
echo "Image:           $IMAGE"
echo "───────────────────────────────────────────────────"

# ── 1. Resource group ──────────────────────────────────────────────────────
echo "[1/5] Creating resource group..."
az group create -n "$RG" -l "$LOCATION" -o none

# ── 2. Register required providers (one-time per subscription) ─────────────
echo "[2/5] Registering providers (idempotent, may take 1-2 min if first time)..."
az provider register --namespace Microsoft.App -o none
az provider register --namespace Microsoft.OperationalInsights -o none
az provider register --namespace Microsoft.Cache -o none

# ── 3. Container Apps environment ──────────────────────────────────────────
echo "[3/5] Creating Container Apps environment (this can take 3-5 min)..."
if ! az containerapp env show -n "$ENV_NAME" -g "$RG" -o none 2>/dev/null; then
  az containerapp env create -n "$ENV_NAME" -g "$RG" -l "$LOCATION" -o none
fi

# ── 4. Azure Cache for Redis (Basic C0) ────────────────────────────────────
echo "[4/5] Creating Azure Cache for Redis (this takes 15-20 min — go grab coffee)..."
if ! az redis show -n "$REDIS_NAME" -g "$RG" -o none 2>/dev/null; then
  az redis create -n "$REDIS_NAME" -g "$RG" -l "$LOCATION" \
    --sku Basic --vm-size C0 -o none
fi

REDIS_HOST=$(az redis show -n "$REDIS_NAME" -g "$RG" --query hostName -o tsv)
REDIS_KEY=$(az redis list-keys -n "$REDIS_NAME" -g "$RG" --query primaryKey -o tsv)
REDIS_CS="${REDIS_HOST}:6380,password=${REDIS_KEY},ssl=True,abortConnect=False"

# ── 5. Container App for the API ───────────────────────────────────────────
echo "[5/5] Deploying API container app..."
if az containerapp show -n "$API_NAME" -g "$RG" -o none 2>/dev/null; then
  echo "      → updating existing app"
  az containerapp secret set -n "$API_NAME" -g "$RG" \
    --secrets "jwt-key=$JWT_KEY" "redis-cs=$REDIS_CS" -o none
  az containerapp update -n "$API_NAME" -g "$RG" \
    --image "$IMAGE" \
    --set-env-vars \
      "Jwt__SigningKey=secretref:jwt-key" \
      "ConnectionStrings__Redis=secretref:redis-cs" \
      "Cors__AllowedOrigins__0=$CORS_ORIGIN" \
      "ASPNETCORE_ENVIRONMENT=Production" \
    -o none
else
  echo "      → creating new app"
  az containerapp create -n "$API_NAME" -g "$RG" \
    --environment "$ENV_NAME" \
    --image "$IMAGE" \
    --target-port 8080 \
    --ingress external \
    --transport auto \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets "jwt-key=$JWT_KEY" "redis-cs=$REDIS_CS" \
    --env-vars \
      "Jwt__SigningKey=secretref:jwt-key" \
      "ConnectionStrings__Redis=secretref:redis-cs" \
      "Cors__AllowedOrigins__0=$CORS_ORIGIN" \
      "ASPNETCORE_ENVIRONMENT=Production" \
    -o none
fi

API_URL=$(az containerapp show -n "$API_NAME" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "── Done ───────────────────────────────────────────"
echo "Backend URL:      https://$API_URL"
echo "Health check:     https://$API_URL/healthz"
echo "Redis:            $REDIS_NAME (Basic C0, ~\$16/mo)"
echo ""
echo "Next steps:"
echo "  1. Test:        curl https://$API_URL/healthz"
echo "  2. Deploy SWA:  cd Omi.Client && npm run build && swa deploy ./dist --env production"
echo "  3. After SWA is up, re-run with CORS_ORIGIN=https://<your-swa-url> to lock CORS"
echo ""
echo "Save your JWT key somewhere safe — it's been generated, not stored:"
echo "  JWT_KEY=$JWT_KEY"
echo "───────────────────────────────────────────────────"
