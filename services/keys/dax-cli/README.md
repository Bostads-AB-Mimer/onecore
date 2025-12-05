# DAX CLI - .NET Wrapper for DAX API

This directory contains a self-contained .NET executable that wraps the DAX SDK for calling from Node.js/TypeScript.

## How it Works

1. The `DaxCli` project is built as a self-contained executable for Linux
2. It includes the .NET runtime, so no .NET installation is needed on the server
3. It can be called from Node.js using `child_process`
4. The Dockerfile automatically builds and includes the binaries

## Local Development

### Building for Windows (testing):
```bash
cd DaxCli
dotnet publish -c Release -r win-x64 --self-contained true
```

### Building for Linux (production):
```bash
cd DaxCli
dotnet publish -c Release -r linux-x64 --self-contained true
```

The output will be in: `DaxCli/bin/Release/net8.0/{platform}/publish/`

## Docker/Kubernetes Deployment

The `Dockerfile` has been configured to automatically:
1. Build the .NET CLI in a `dotnet-builder` stage
2. Copy the compiled binaries to the runtime container
3. Make them available at the correct path for the TypeScript wrapper

The wrapper automatically detects the platform (Windows/Linux) and uses the correct binary.

### Environment Variables Required

In your Kubernetes deployment, ensure these environment variables are set (via ConfigMap or Secret):

```yaml
- name: ALLIERA__API_URL
  value: "https://api-prod.dax.amido.io"
- name: ALLIERA__CLIENT_ID
  value: "your-instance-guid"
- name: ALLIERA__USERNAME
  value: "your-username"
- name: ALLIERA__PASSWORD
  valueFrom:
    secretKeyRef:
      name: dax-credentials
      key: password
- name: ALLIERA__PEM_KEY_PATH
  value: "/app/private.pem"
```

You'll also need to mount the private key as a secret or volume.

## Usage from TypeScript

Use the helper function from `dax-cli-wrapper.ts`:

```typescript
import { getContractsCli } from './adapters/dax-cli-wrapper'

const contracts = await getContractsCli()
```

Or call directly:

```typescript
import { callDaxCli } from './adapters/dax-cli-wrapper'

const result = await callDaxCli('getcontracts')
```

## Available Commands

- `getcontracts` - Get all contracts

## Testing

Run the test script:
```bash
pnpx ts-node -r dotenv/config src/services/key-service/adapters/test-dax-cli.ts
```
