# Azure Deployment

## One-time setup

```bash
# Install Azure CLI
brew install azure-cli

# Install Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Log into Azure
az login
```

## Deploy backend

```bash
chmod +x deploy/azure-deploy.sh
./deploy/azure-deploy.sh
```

Total time: ~20 minutes (most of it is Redis provisioning).

The script will print your backend URL at the end. Save it.

## Deploy frontend

```bash
cd Omi.Client
npm run build
swa deploy ./dist --env production
```

The CLI will prompt for:
- Resource group: `omi-rg`
- Region: `eastus2` (SWA isn't in every region)
- Static Web App name: `omi-web`
- SKU: `Free`

After deploy completes, copy the SWA URL it prints.

## Wire frontend → backend

In the Azure Portal:
1. Open your Static Web App
2. **APIs → Link** → choose **Container Apps** → pick `omi-api`
3. This makes `/api/*` and `/ws/*` from the frontend automatically proxy to the backend (no CORS config needed)

## Lock CORS (optional but cleaner)

Re-run the deploy script with the SWA origin:

```bash
CORS_ORIGIN="https://omi-web-xxx.azurestaticapps.net" ./deploy/azure-deploy.sh
```

## Tear down (end of trial)

```bash
az group delete -n omi-rg --yes --no-wait
```

Deletes everything in one shot.
