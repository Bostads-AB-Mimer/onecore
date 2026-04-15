# ONECore Helm Chart

[![License](https://img.shields.io/badge/license-AGPL--3.0--only-green.svg)](LICENSE)
[![Helm](https://img.shields.io/badge/Helm-3%2B-blue.svg)](https://helm.sh)

Helm chart för att installera hela ONECore-plattformen i ett Kubernetes-kluster.

## Prerequisites

- Kubernetes 1.23+
- Helm 3.8.0+
- Traefik ingress controller
- cert-manager (för SSL-certifikat)

## Installation

### Ladda ner dependencies

Chartet använder **Bitnami Common Library** för avancerade features. Ladda ner dependencies:

```bash
cd onecore-chart
HELM_EXPERIMENTAL_OCI=1 helm dependency update
```

### Installera chartet

```bash
# Installera alla komponenter med default values
helm install onecore ./onecore-chart

# Installera med custom values
helm install onecore ./onecore-chart -f values.yaml

# Installera bara core + property-tree
helm install onecore ./onecore-chart \
  --set components.core.enabled=true \
  --set components.propertyTree.enabled=true \
  --set global.hostname=onecore.example.com
```

### Uppgradera chartet

```bash
helm upgrade onecore ./onecore-chart
```

### Ta bort installation

```bash
helm uninstall onecore
```

## Configuration

Se [values.yaml](values.yaml) för alla konfigurationsalternativ.

### Global Configuration

```yaml
global:
  environment: dev
  hostname: onecore.example.com
  clusterDomain: dev.mimer.nu
  namespace: onecore
  imagePullSecret: regcred
```

### Component Toggles

Aktivera/inaktivera specifika komponenter:

```yaml
components:
  core:
    enabled: true
    replicas: 2
  propertyTree:
    enabled: true
    replicas: 1
  communication:
    enabled: false
```

### Bitnami Common Library Features

Chartet använder Bitnami Common Library vilket ger tillgång till avancerade features:

#### Extra Environment Variables

```yaml
components:
  core:
    extraEnv:
      - name: CUSTOM_VAR
        value: 'custom-value'
      - name: SECRET_VAR
        valueFrom:
          secretKeyRef:
            name: my-secret
            key: secret-key
```

#### Extra Volumes

```yaml
components:
  core:
    extraVolumes:
      - name: custom-volume
        configMap:
          name: custom-config
    extraVolumeMounts:
      - name: custom-volume
        mountPath: /etc/custom/config
        readOnly: true
```

#### Sidecar Containers

```yaml
components:
  core:
    sidecars:
      - name: log-collector
        image: fluent/fluent-bit:latest
        volumeMounts:
          - name: logs
            mountPath: /var/log
```

#### Init Containers

```yaml
components:
  core:
    initContainers:
      - name: init-db
        image: busybox:latest
        command: ['sh', '-c', 'echo init']
```

#### Security Context

```yaml
components:
  core:
    podSecurityContext:
      fsGroup: 1001
      runAsNonRoot: true
    containerSecurityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
```

#### Health Checks

```yaml
components:
  core:
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
```

#### Scheduling

```yaml
components:
  core:
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
```

## Komponenter

### Backend Services (11 st)

- **core** - API Gateway och central orkestrering
- **communication** - Kommunikationstjänst
- **contacts** - Kontaktregister
- **economy** - Ekonomitjänst
- **file-storage** - Filhantering
- **inspection** - Besiktningstjänst
- **keys** - Nyckelhantering
- **leasing** - Uthyrningstjänst
- **property** - Fastighetsdata
- **property-management** - Fastighetsförvaltning
- **work-order** - Arbetsorderhantering

### Frontend Applications (3 st)

- **internal-portal** - Intern portal (frontend + backend)
- **keys-portal** - Nyckelportal
- **property-tree** - Fastighetsträd

## Tips

### Testa installation lokalt

```bash
# Rendera manifests utan att installera
helm template onecore ./onecore-chart -f values.yaml

# Linta chartet
helm lint ./onecore-chart
```

### Visa alla values

```bash
helm show values ./onecore-chart
```

### Debug installation

```bash
# Installera med debug output
helm install --debug onecore ./onecore-chart

# Få mer detaljerad info
helm get manifest onecore
helm get values onecore
```

## Bitnami Common Library

Detta chart använder [Bitnami Common Library Chart](https://github.com/bitnami/charts/tree/main/bitnami/common) som ger tillgång till:

- Standard helpers för labels, names, secrets
- Advanced features (extraEnv, sidecars, initContainers)
- Security context management
- Health checks
- Affinity/tolerations
- Resource management
- Validation helpers

Se [Bitnami Common Library dokumentation](https://github.com/bitnami/charts/tree/main/bitnami/common) för alla tillgängliga features.

## Support

För support och frågor, kontakta dev@mimer.nu eller öppna en issue på GitHub.

## License

AGPL-3.0-only - Se [LICENSE](LICENSE) för detaljer.
