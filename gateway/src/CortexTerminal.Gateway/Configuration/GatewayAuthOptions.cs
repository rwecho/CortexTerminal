namespace CortexTerminal.Gateway.Configuration;

public sealed class GatewayAuthOptions
{
    public const string SectionName = "GatewayAuth";

    public string Issuer { get; init; } = "http://localhost:5050/";

    public string WorkerClientId { get; init; } = "cortex-worker";

    public string WorkerClientSecret { get; init; } = "change-me-worker-secret";
}