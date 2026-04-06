namespace CortexTerminal.Gateway.Configuration;

public sealed class GatewayInfrastructureOptions
{
    public const string SectionName = "GatewayInfrastructure";
    public const string PostgresConnectionStringName = "GATEWAY_POSTGRES_CONNECTION_STRING";
    public const string RedisConnectionStringName = "GATEWAY_REDIS_CONNECTION_STRING";

    public string PostgresConnectionString { get; init; } = string.Empty;

    public string RedisConnectionString { get; init; } = string.Empty;
}
