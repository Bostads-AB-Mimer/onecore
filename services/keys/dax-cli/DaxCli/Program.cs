using System.Text.Json;
using Amido.Dax.Contracts.Contracts;
using Amido.Dax.WebClient;
using Amido.Dax.WebClient.Configuration;
using Amido.Dax.WebClient.Requests;
using AmidoAB.Dax.ExampleClient;
using Microsoft.Extensions.Logging;

if (args.Length < 1)
{
    Console.Error.WriteLine("Usage: DaxCli <command> [json-params]");
    Console.Error.WriteLine("Commands: getContracts");
    Environment.Exit(1);
}

var command = args[0];

try
{
    // Read config from environment variables
    var apiUrl = Environment.GetEnvironmentVariable("DAX_API_URL") ?? throw new Exception("DAX_API_URL not set");
    var instanceId = Environment.GetEnvironmentVariable("DAX_INSTANCE_ID") ?? throw new Exception("DAX_INSTANCE_ID not set");
    var username = Environment.GetEnvironmentVariable("DAX_USERNAME") ?? throw new Exception("DAX_USERNAME not set");
    var password = Environment.GetEnvironmentVariable("DAX_PASSWORD") ?? throw new Exception("DAX_PASSWORD not set");
    var privateKey = Environment.GetEnvironmentVariable("DAX_PRIVATE_KEY") ?? throw new Exception("DAX_PRIVATE_KEY not set");

    // Initialize DAX client
    var config = new DaxWebClientConfigurationBuilder()
        .WithApiUrl(apiUrl)
        .WithInstanceId(Guid.Parse(instanceId))
        .WithCredentials(username, password)
        .WithPrivateKey(privateKey)
        .WithTimeout(30000)
        .Build();

    var client = new DaxWebClient(new SimpleLogger(), new SimpleHttpClientFactory());
    client.Initialize(config);

    // Execute command
    object? result = command.ToLower() switch
    {
        "getcontracts" => await GetContracts(client),
        _ => throw new ArgumentException($"Unknown command: {command}")
    };

    // Output result as JSON
    Console.WriteLine(JsonSerializer.Serialize(result));
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    Environment.Exit(1);
}

static async Task<GetContractsResponse> GetContracts(DaxWebClient client)
{
    var request = new DaxWebRequestBuilder<GetContractsRequest, GetContractsResponse>()
        .AddRequest(new GetContractsRequest(new ContractsResourceIdentifier()))
        .SetContext("GetContracts")
        .Build();

    var response = await client.CallAsync(request);
    return response.Response;
}

class SimpleLogger : ILogger
{
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception,
        Func<TState, Exception, string> formatter)
    {
        var level = logLevel.ToString()[..3].ToUpper();
        var ts = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
        var msg = formatter(state, exception);
        Console.Error.WriteLine($"[{ts}] [{level}] {msg}");
    }

    public bool IsEnabled(LogLevel logLevel) => true;

    public IDisposable BeginScope<TState>(TState state) where TState : notnull => null!;
}
