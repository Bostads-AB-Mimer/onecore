{{/*
Copyright Bostads AB Mimer.
SPDX-License-Identifier: AGPL-3.0-only
*/}}

{{- define "onecore.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "onecore.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "onecore.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "onecore.componentName" -}}
{{- printf "%s-%s" (include "onecore.fullname" .root) (lower .name) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "onecore.labels" -}}
helm.sh/chart: {{ include "onecore.chart" .root }}
app.kubernetes.io/name: {{ include "onecore.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ lower .name }}
{{- if .root.Chart.AppVersion }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- end }}

{{- define "onecore.selectorLabels" -}}
app.kubernetes.io/name: {{ include "onecore.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ lower .name }}
{{- end }}

{{- define "onecore.envPort" -}}
{{- $port := 80 -}}
{{- if kindIs "map" .env -}}
{{- if hasKey .env "PORT" -}}
{{- $port = int (get .env "PORT") -}}
{{- end -}}
{{- end -}}
{{- $port -}}
{{- end }}