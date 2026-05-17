# ONECore Helm Chart

Helm chart för att installera hela ONECore-plattformen i ett Kubernetes-kluster.

## Installation

```bash
# Installera dependencies
cd onecore-chart && HELM_EXPERIMENTAL_OCI=1 helm dependency update

# Installera med default värden
helm install onecore ./onecore-chart

# Installera med custom values
helm install onecore ./onecore-chart -f my-values.yaml

# Installera bara specifika komponenter
helm install onecore ./onecore-chart \
  --set components.core.enabled=true \
  --set components.propertyTree.enabled=true
```

## Konfiguration

All konfiguration sker i `values.yaml` under `components`:

```yaml
components:
  core:
    enabled: true
    replicas: 2
    image: ghcr.io/bostads-ab-mimer/onecore/onecore-core:latest
    env:
      APPLICATION_NAME: core
      SERVICE_URL__LEASING: http://leasing
    secrets:
      - name: db-url        # Skapar env-variabeln DB_URL
      - name: api-key
        envName: API_KEY    # Använd custom env-namn
    resources:
      limits:
        memory: 512Mi
    ingress:
      enabled: true
      host: api.${global.hostname}

  propertyTree:
    enabled: true
    image: ghcr.io/bostads-ab-mimer/onecore-property-tree:latest
    env:
      VITE_API_URL: https://api.${global.hostname}
    ingress:
      enabled: true
      host: property-tree.${global.hostname}
```

### Struktur per komponent

Varje komponent stödjer:

- `enabled` - Aktivera/inaktivera
- `replicas` - Antal poddar
- `image` - Container image
- `env` - Miljövariabler (renderas som ConfigMap)
- `secrets` - Hemliga värden (refererar till Secret)
- `resources` - CPU/minne limits
- `ingress` - Exponera via Traefik
- `health` - Liveness/readiness probes
- `cronJobs` - Schemalagda jobb

## Global konfiguration

```yaml
global:
  hostname: onecore.example.com
  namespace: onecore
  imagePullSecret: regcred

ingress:
  enabled: true
  className: traefik
  certManagerClusterIssuer: letsencrypt
```

## Komponenter

### Backend Services
- **core** - API Gateway
- **communication** - Kommunikationstjänst
- **contacts** - Kontaktregister
- **economy** - Ekonomitjänst
- **keys** - Nyckelhantering
- **leasing** - Uthyrning (med cronjob)
- **property** - Fastighetsdata
- **propertyManagement** - Fastighetsförvaltning
- **workOrder** - Arbetsorder
- **fileStorage** - Fillagring (valfri)
- **inspection** - Besiktning (valfri)

### Frontend Applications
- **propertyTree** - Fastighetsträd
- **keysPortal** - Nyckelportal
- **internalPortal** - Intern portal (frontend/backend)

## Tips

```bash
# Se genererade manifests utan att installera
helm template onecore ./onecore-chart

# Linta chartet
helm lint ./onecore-chart

# Visa alla values
helm show values ./onecore-chart
```