# ONECore Helm Chart - Project Overview

## 📋 Sammanfattning

Detta Helm chart gör det möjligt att installera hela ONECore-plattformen i ett Kubernetes-kluster med ett enda kommando. Chartet är modulärt och gör det möjligt att installera alla eller delar av komponenterna med enkel konfiguration.

## 🎯 Målbild

En användare ska kunna köra:

```bash
helm install onecore ./onecore-chart -f values.yaml
```

Och få en fullt fungerande ONECore-miljö med:

- Alla valda applikationer installerade
- Ingress konfigurerad med SSL-certifikat
- Databaser och infrastruktur uppsatta
- Environment variables korrekt konfigurerade

## 🏗️ Komponenter

### Backend Services (11 st)

- **core** - API Gateway och central orkestrering
- **communication** - Kommunikationstjänst
- **contacts** - Kontaktregister
- **economy** - Ekonomitjänst
- **file-storage** - Filhantering
- **inspection** - Besiktningstjänst
- **keys** - Nyckelhantering
- **leasing** - Uthyrningstjänst + cronjob
- **property** - Fastighetsdata
- **property-management** - Fastighetsförvaltning
- **work-order** - Arbetsorderhantering

### Frontend Applications (3 st)

- **internal-portal** - Intern portal (frontend + backend)
- **keys-portal** - Nyckelportal
- **property-tree** - Fastighetsträd

### Infrastructure Dependencies

- **MSSQL** - Databas
- **Elasticsearch** - Loggning
- **Keycloak** - Autentisering
- **MinIO** - Object storage
- **Traefik** - Ingress controller (krävs i klustret)

## 🚀 Installation

### Förutsättningar

- Kubernetes kluster (minikube, kind, eller cloud provider)
- Helm 3.x installerat
- Traefik ingress controller installerad
- cert-manager installerad (för SSL-certifikat)

### Grundläggande installation

```bash
# Installera alla komponenter
helm install onecore ./onecore-chart -f values.yaml

# Installera bara core + property-tree
helm install onecore ./onecore-chart \
  --set components.core.enabled=true \
  --set components.propertyTree.enabled=true \
  --set hostname=onecore.example.com
```

### Uppdatera installation

```bash
helm upgrade onecore ./onecore-chart -f values.yaml
```

### Ta bort installation

```bash
helm uninstall onecore
```

## 🔧 Values.yaml Struktur

### Global Configuration

```yaml
# Global settings
global:
  # Miljönamn (används i resource names)
  environment: dev

  # Hostname för alla applikationer
  hostname: onecore.example.com

  # Cluster domain för auth
  clusterDomain: dev.mimer.nu

  # Namespace där allt ska installeras
  namespace: onecore

  # Image pull secret för GHCR
  imagePullSecret: regcred

  # Common labels för alla resurser
  labels:
    app: onecore
    environment: dev
```

### Component Toggles

```yaml
# Aktivera/inaktivera komponenter
components:
  # Backend services
  core:
    enabled: true
    replicas: 1
    image:
      repository: ghcr.io/bostads-ab-mimer/onecore/onecore-core
      tag: latest

  communication:
    enabled: true
    replicas: 1
    image:
      repository: ghcr.io/bostads-ab-mimer/onecore/onecore-communication
      tag: latest

  # ... fler backend services

  # Frontend applications
  propertyTree:
    enabled: true
    replicas: 1
    image:
      repository: ghcr.io/bostads-ab-mimer/property-tree
      tag: latest

  keysPortal:
    enabled: true
    replicas: 1
    image:
      repository: ghcr.io/bostads-ab-mimer/onecore/onecore-keys-portal
      tag: latest

  internalPortal:
    enabled: false # Default avstängd
    frontend:
      enabled: false
      image:
        repository: ghcr.io/bostads-ab-mimer/onecore/internal-portal-frontend
        tag: latest
    backend:
      enabled: false
      image:
        repository: ghcr.io/bostads-ab-mimer/onecore/internal-portal-backend
        tag: latest
```

### Infrastructure Configuration

```yaml
# Databaser och externt beroenden
infrastructure:
  # MSSQL Database
  mssql:
    enabled: true # Installera via subchart eller använd befintlig
    host: mssql
    port: 1433
    databasePrefix: ''
    secrets:
      username: sa
      password: '' # Sätt via --set eller values-secret.yaml

  # Elasticsearch för loggning
  elasticsearch:
    enabled: true
    host: elasticsearch.logging.svc.cluster.local
    port: 9200

  # Keycloak för autentisering
  keycloak:
    enabled: true
    url: https://auth.dev.mimer.nu
    realm: onecore
    clientId: onecore

  # MinIO för filstorage
  minio:
    enabled: true
    host: minio
    port: 9000
    accessKey: ''
    secretKey: ''
```

### Ingress Configuration

```yaml
# Ingress inställningar
ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt

  # Hostname patterns för olika komponenter
  hosts:
    core: api.${global.hostname}
    propertyTree: property-tree.${global.hostname}
    keysPortal: keys-portal.${global.hostname}
    internalPortal: internal-portal.${global.hostname}
```

### Secrets Configuration

```yaml
# Secrets (rekommenderas att hanteras via sealed-secrets eller vault)
secrets:
  # Core secrets
  core:
    auth:
      jwtSecret: ''
      keycloakClientSecret: ''

  # Service-specific secrets
  communication:
    infobipApiKey: ''

  economy:
    database:
      user: ''
      password: ''
    xledger:
      apiToken: ''
      url: ''
      sftp:
        host: ''
        username: ''
        password: ''

  leasing:
    database:
      url: ''
    xpand:
      url: ''
      apiKey: ''

  # ... fler secrets
```

### CronJobs Configuration

```yaml
# CronJobs för schemalagda uppgifter
cronJobs:
  leasing:
    expireListings:
      enabled: true
      schedule: '0 2 * * *' # Dagligen kl 02:00
      image:
        repository: ghcr.io/bostads-ab-mimer/onecore/onecore-leasing
        tag: latest
```

### Resource Configuration

```yaml
# Resurser för alla komponenter
resources:
  defaults:
    requests:
      memory: 128Mi
      cpu: 100m
    limits:
      memory: 256Mi
      cpu: 200m

  # Överrida per komponent
  core:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
```

## 📁 Exempel på values-full.yaml

```yaml
global:
  environment: dev
  hostname: onecore.dev.mimer.nu
  clusterDomain: dev.mimer.nu
  namespace: onecore
  imagePullSecret: regcred

components:
  core:
    enabled: true
    replicas: 1
  propertyTree:
    enabled: true
    replicas: 1
  keysPortal:
    enabled: true
    replicas: 1
  communication:
    enabled: true
    replicas: 1
  leasing:
    enabled: true
    replicas: 1
  property:
    enabled: true
    replicas: 1
  economy:
    enabled: true
    replicas: 1
  contacts:
    enabled: true
    replicas: 1
  keys:
    enabled: true
    replicas: 1
  workOrder:
    enabled: true
    replicas: 1
  propertyManagement:
    enabled: true
    replicas: 1
  inspection:
    enabled: false
    replicas: 1
  fileStorage:
    enabled: false
    replicas: 1

infrastructure:
  mssql:
    enabled: true
    host: mssql
    port: 1433
  elasticsearch:
    enabled: true
    host: elasticsearch.logging.svc.cluster.local
    port: 9200
  keycloak:
    enabled: true
    url: https://auth.dev.mimer.nu
    realm: onecore
    clientId: onecore

ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt

cronJobs:
  leasing:
    expireListings:
      enabled: true
      schedule: '0 2 * * *'

secrets:
  # Sätt dessa via --set-file eller k8s secrets
  core:
    auth:
      jwtSecret: ''
  communication:
    infobipApiKey: ''
  economy:
    database:
      user: ''
      password: ''
  leasing:
    database:
      url: ''
```

## 🎯 Exempel på Minimal Installation

```bash
# Installera bara core + property-tree för snabb test
helm install onecore ./onecore-chart \
  --set global.hostname=onecore.test.com \
  --set components.core.enabled=true \
  --set components.propertyTree.enabled=true \
  --set infrastructure.mssql.enabled=false \
  --set infrastructure.elasticsearch.enabled=false
```

## 🔄 Workflow för Ny Miljö

1. **Skapa values.yaml** för miljön
2. **Generera secrets** (använd sealed-secrets eller k8s secrets)
3. **Installera infrastructure** (MSSQL, Elasticsearch, etc) om de inte finns
4. **Installera onecore** med helm
5. **Verifiera installation** med `helm test onecore`

## 📚 Dokumentation

- `values.yaml` - Alla konfigurationsalternativ
- `README.md` - Detaljerad installationsguide
- `ARCHITECTURE.md` - Arkitekturbeskrivning
- `TROUBLESHOOTING.md` - Vanliga problem och lösningar

## 🔐 Säkerhet

- Secrets ska aldrig committas till git
- Använd sealed-secrets eller Vault för produktionsmiljöer
- Aktivera RBAC för klustret
- Använd network policies för att begränsa trafik

### Resource Configuration

```yaml
# Resurser för alla komponenter
resources:
  defaults:
    requests:
      memory: 128Mi
      cpu: 100m
    limits:
      memory: 256Mi
      cpu: 200m

  # Överrida per komponent
  core:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
```

### Advanced Configuration (via Bitnami Common Library)

```yaml
# Bitnami common library ger oss avancerade features som:
components:
  core:
    # Extra environment variables
    extraEnv:
      - name: CUSTOM_VAR
        value: 'custom-value'
      - name: SECRET_VAR
        valueFrom:
          secretKeyRef:
            name: my-secret
            key: secret-key

    # Extra volumes
    extraVolumes:
      - name: custom-volume
        configMap:
          name: custom-config

    extraVolumeMounts:
      - name: custom-volume
        mountPath: /etc/custom/config
        readOnly: true

    # Sidecar containers
    sidecars:
      - name: log-collector
        image: fluent/fluent-bit:latest

    # Init containers
    initContainers:
      - name: init-db
        image: busybox:latest
        command: ['sh', '-c', 'echo init']

    # Security context
    podSecurityContext:
      fsGroup: 1001
      runAsNonRoot: true

    containerSecurityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true

    # Health checks
    livenessProbe:
      httpGet:
        path: /health
        port: 80
      initialDelaySeconds: 30

    readinessProbe:
      httpGet:
        path: /ready
        port: 80
      initialDelaySeconds: 10

    startupProbe:
      httpGet:
        path: /ready
        port: 80
      failureThreshold: 30

    # Scheduling
    affinity:
      nodeAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            preference:
              matchExpressions:
                - key: node-role.kubernetes.io/application
                  operator: In
                  values:
                    - onecore

    tolerations:
      - key: dedicated
        operator: Equal
        value: onecore
        effect: NoSchedule

    nodeSelector:
      node-role.kubernetes.io/application: onecore

    # Service account
    serviceAccount:
      create: true
      name: ''
      annotations: {}

    # Pod labels and annotations
    podLabels:
      component: core
      app: onecore

    podAnnotations:
      prometheus.io/scrape: 'true'
```

## 🔧 Bitnami Common Library Integration

Vi använder **Bitnami Common Library Chart** som bas för att få tillgång till avancerade Helm features utan att behöva implementera dem själva.

### Fördelar med Bitnami Common Library

- ✅ **Färdiga helpers** för labels, names, secrets, image handling
- ✅ **Advanced features** som extraEnv, sidecars, init containers
- ✅ **Security context** management
- ✅ **Health checks** (liveness, readiness, startup)
- ✅ **Affinity/tolerations** och scheduling
- ✅ **Resource management** med presets
- ✅ **Validation helpers** för values
- ✅ **Compatibility layer** för olika Kubernetes versioner
- ✅ **Secret management** med existing secret support
- ✅ **Image handling** med pull secrets och version management

### Chart Dependency

```yaml
# Chart.yaml
dependencies:
  - name: common
    repository: oci://registry-1.docker.io/bitnamicharts
    version: 2.x.x
    tags:
      - bitnami-common
    condition: global.common.enabled
```

### Installation

```bash
# Installera dependencies
helm dependency update ./onecore-chart

# Installera med alla features
helm install onecore ./onecore-chart -f values.yaml

# Använd Bitnami common features
helm install onecore ./onecore-chart \
  --set components.core.extraEnv[0].name=CUSTOM_VAR \
  --set components.core.extraEnv[0].value=custom-value
```

## 🚀 Nästa Steg

1. Skapa Helm chart struktur med Bitnami common dependency
2. Implementera templates som använder Bitnami common helpers
3. Skapa values.yaml med default värden + advanced options
4. Testa advanced features (extraEnv, sidecars, etc)
5. Skapa dokumentation för alla available features
6. Testa installation i test-kluster
7. Skapa CI/CD för chartet
