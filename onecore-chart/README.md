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
    cronJobs:
      expire-listings:
        enabled: true
        schedule: '0 2 * * *'
        command: ['npm', 'run', 'script:expire-listings']
    autoscaling:
      enabled: true
      minReplicas: 2
      maxReplicas: 10
      targetCPUUtilizationPercentage: 70
    serviceAccount:
      create: true
      annotations:
        eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/onecore-core
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
- `autoscaling` - Horizontal Pod Autoscaler
- `serviceAccount` - Kubernetes Service Account

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
  middlewares:
    cors:
      enabled: true
    basicAuth:
      enabled: false
      secretName: basic-auth
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

## Generated Resources

| Resource | Count | Beskrivning |
|----------|-------|-------------|
| Deployment | 11 | Alla backend + frontend |
| Service | 11 | ClusterIP per komponent |
| ConfigMap | 11 | Env-variabler per komponent |
| Ingress | 3 | Traefik med SSL |
| Secret | 5 | Hemliga värden |
| CronJob | 1 | Schemalagda jobb |
| Middleware | 1 | CORS etc |
| **Total** | **43** | |

## Tips

```bash
# Se genererade manifests utan att installera
helm template onecore ./onecore-chart

# Linta chartet
helm lint ./onecore-chart

# Visa alla values
helm show values ./onecore-chart

# Rendera endast specifik komponent
helm template onecore ./onecore-chart --set components.core.enabled=true --set components.propertyTree.enabled=false
```