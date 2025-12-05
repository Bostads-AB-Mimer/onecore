# DAX CLI Deployment Guide

## Overview

The DAX CLI is a self-contained .NET application that wraps the official Amido DAX SDK. It allows your Node.js/TypeScript application to call the DAX API without implementing the complex signature authentication in JavaScript.

## Architecture

```
TypeScript Code (dax-cli-wrapper.ts)
         ↓ spawns process
    .NET CLI (DaxCli)
         ↓ uses
    DAX SDK (from GitHub)
         ↓ calls
    DAX API (api-prod.dax.amido.io)
```

## Files Structure

```
services/keys/
├── dax-cli/
│   ├── dax.net/                    # Cloned from GitHub
│   ├── DaxCli/
│   │   ├── Program.cs              # CLI entry point
│   │   ├── DaxCli.csproj          # Project file
│   │   └── bin/Release/           # Compiled binaries (gitignored)
│   └── README.md
├── src/services/key-service/adapters/
│   ├── dax-cli-wrapper.ts         # TypeScript helper
│   └── test-dax-cli.ts            # Test script
└── Dockerfile                      # Builds both Node.js and .NET
```

## Docker Build Process

The Dockerfile uses multi-stage builds:

### Stage 1: .NET Build (`dotnet-builder`)
- Uses `mcr.microsoft.com/dotnet/sdk:8.0`
- Copies `services/keys/dax-cli/`
- Runs `dotnet publish` with self-contained Linux build
- Outputs to `/dotnet/out`

### Stage 2: Node.js Build (`builder`)
- Builds TypeScript application as usual
- Uses pnpm to build and deploy

### Stage 3: Runtime (`runner`)
- Uses `node:23-slim` (no .NET needed!)
- Copies Node.js app from `builder`
- Copies .NET binaries from `dotnet-builder`
- Final image contains both

## Kubernetes Deployment

### ConfigMap Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: keys-service-config
data:
  ALLIERA__API_URL: "https://api-prod.dax.amido.io"
  ALLIERA__CLIENT_ID: "c568f15f-fddc-4a5f-9064-fdf245c895e0"
  ALLIERA__USERNAME: "4b63b282-cad5-425d-848c-4c03a27112e2"
  ALLIERA__PEM_KEY_PATH: "/app/secrets/private.pem"
```

### Secret Example

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dax-credentials
type: Opaque
stringData:
  password: "your-dax-password"
  private.pem: |
    -----BEGIN PRIVATE KEY-----
    MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
    -----END PRIVATE KEY-----
```

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keys-service
spec:
  template:
    spec:
      containers:
      - name: keys-service
        image: your-registry/keys-service:latest
        envFrom:
        - configMapRef:
            name: keys-service-config
        env:
        - name: ALLIERA__PASSWORD
          valueFrom:
            secretKeyRef:
              name: dax-credentials
              key: password
        volumeMounts:
        - name: dax-key
          mountPath: /app/secrets
          readOnly: true
      volumes:
      - name: dax-key
        secret:
          secretName: dax-credentials
          items:
          - key: private.pem
            path: private.pem
```

## Important Notes

### ✅ What's Included in the Image
- Self-contained .NET runtime (~70MB)
- DAX SDK libraries
- All dependencies

### ❌ What's NOT Needed
- .NET installation on the host/cluster
- Separate DAX SDK deployment
- Additional runtime dependencies

### 🔒 Security Considerations
- Private key stored as Kubernetes secret
- Password stored as Kubernetes secret
- Secrets mounted as files (not env vars for PEM key)
- No secrets in image or ConfigMap

### 📦 Image Size
- Base Node.js image: ~200MB
- + .NET self-contained: ~70MB
- = Total: ~270MB (acceptable for Kubernetes)

## Testing the Build

### Local Docker Build
```bash
# From onecore root
docker build -f services/keys/Dockerfile -t keys-service:test .

# Test the container
docker run --rm \
  -e ALLIERA__API_URL="https://api-prod.dax.amido.io" \
  -e ALLIERA__CLIENT_ID="your-id" \
  -e ALLIERA__USERNAME="your-username" \
  -e ALLIERA__PASSWORD="your-password" \
  -e ALLIERA__PEM_KEY_PATH="/app/private.pem" \
  -v $(pwd)/services/keys/private.pem:/app/private.pem:ro \
  keys-service:test
```

### Verify .NET CLI in Container
```bash
docker run --rm keys-service:test ls -lh /app/dax-cli/DaxCli/bin/Release/net8.0/linux-x64/publish/
```

You should see:
- `DaxCli` (executable)
- Various `.dll` files
- `DaxCli.deps.json`
- etc.

## Troubleshooting

### Issue: "DaxCli: command not found"
**Solution**: Check that the COPY path in Dockerfile matches the CLI_PATH in dax-cli-wrapper.ts

### Issue: "Permission denied" when running DaxCli
**Solution**: The self-contained Linux binary should be executable by default, but you can add to Dockerfile:
```dockerfile
RUN chmod +x /app/dax-cli/DaxCli/bin/Release/net8.0/linux-x64/publish/DaxCli
```

### Issue: "Signature mismatch"
**Solution**: Ensure you're using `ALLIERA__CLIENT_ID` not `ALLIERA__OWNING_INSTANCE_ID`

### Issue: Build fails at .NET stage
**Solution**:
1. Check that `dax-cli/dax.net/` exists and contains the cloned GitHub repo
2. Verify the path in COPY matches your structure
3. Check .NET SDK version compatibility

## Performance

### Startup Time
- Cold start: ~500ms (spawning .NET process)
- Warm requests: Uses same process, faster

### Memory Usage
- .NET CLI process: ~50MB RAM
- Per request: Minimal overhead

### Optimization Ideas
- Keep CLI process running (currently spawns per request)
- Add connection pooling in .NET
- Cache OAuth tokens longer

## Future Enhancements

### Possible Improvements
1. Add more DAX API commands (getCardOwner, createContract, etc.)
2. Keep CLI process alive between requests (stdio communication)
3. Add health check endpoint in .NET CLI
4. Add metrics/observability
5. Support batch requests

### Adding New Commands

Edit `DaxCli/Program.cs`:

```csharp
object? result = command.ToLower() switch
{
    "getcontracts" => await GetContracts(client),
    "getcardowner" => await GetCardOwner(client, paramsJson), // Add new command
    _ => throw new ArgumentException($"Unknown command: {command}")
};
```

Then rebuild and redeploy.
