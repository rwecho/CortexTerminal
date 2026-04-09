using System.Text.Json.Serialization;
using CortexTerminal.Gateway.Extensions;
using CortexTerminal.Gateway.Hubs;
using CortexTerminal.Gateway.Services;
using Microsoft.Extensions.Logging;

var relayKeepAliveInterval = TimeSpan.FromSeconds(5);
var relayClientTimeoutInterval = TimeSpan.FromSeconds(15);

GatewayEnvironmentLoader.LoadFromRepositoryRoot();

var builder = WebApplication.CreateBuilder(args);

var gatewayLogLevel = ParseLogLevel(
    Environment.GetEnvironmentVariable("GATEWAY_LOG_LEVEL")
    ?? Environment.GetEnvironmentVariable("LOG_LEVEL"));

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "yyyy-MM-dd HH:mm:ss.fff zzz ";
});
builder.Logging.SetMinimumLevel(gatewayLogLevel);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("gateway", policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true)
            .AllowCredentials();
    });
});

builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024;
    options.KeepAliveInterval = relayKeepAliveInterval;
    options.ClientTimeoutInterval = relayClientTimeoutInterval;
    options.HandshakeTimeout = relayClientTimeoutInterval;
});
builder.Services.AddSingleton<ISessionRegistry, InMemorySessionRegistry>();
builder.Services.AddGatewayManagementInfrastructure(builder.Configuration);
builder.Services.AddGatewayAuthentication(builder.Configuration);

var app = builder.Build();

await app.InitializeGatewayPersistenceAsync();
await app.InitializeGatewayAuthenticationAsync();

app.UseCors("gateway");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "gateway",
    hub = "/hubs/relay",
    management = "/api"
}));
app.MapGatewayAuthEndpoints();
app.MapGatewayWorkerInstallEndpoints();
app.MapGatewayManagementEndpoints();
app.MapHub<ManagementHub>("/hubs/management").RequireAuthorization("GatewayUser");
app.MapHub<RelayHub>("/hubs/relay").RequireAuthorization();

app.Run();

static LogLevel ParseLogLevel(string? value)
{
    return Enum.TryParse<LogLevel>(value, true, out var level)
        ? level
        : LogLevel.Information;
}
