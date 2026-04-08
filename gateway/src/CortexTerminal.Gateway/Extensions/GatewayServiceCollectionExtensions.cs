using CortexTerminal.Gateway.Configuration;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Management;
using CortexTerminal.Gateway.Services.Auth;
using CortexTerminal.Gateway.Services.Sessions;
using CortexTerminal.Gateway.Services.Users;
using CortexTerminal.Gateway.Services.Workers;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using StackExchange.Redis;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayServiceCollectionExtensions
{
    public static IServiceCollection AddGatewayManagementInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var infrastructureOptions = configuration
            .GetSection(GatewayInfrastructureOptions.SectionName)
            .Get<GatewayInfrastructureOptions>()
            ?? new GatewayInfrastructureOptions();

        var postgresConnectionString = ResolveConnectionString(
            infrastructureOptions.PostgresConnectionString,
            configuration,
            nameof(GatewayInfrastructureOptions.PostgresConnectionString),
            GatewayInfrastructureOptions.PostgresConnectionStringName);

        var redisConnectionString = ResolveConnectionString(
            infrastructureOptions.RedisConnectionString,
            configuration,
            nameof(GatewayInfrastructureOptions.RedisConnectionString),
            GatewayInfrastructureOptions.RedisConnectionStringName);

        services.AddDbContext<GatewayDbContext>(options =>
        {
            options.UseNpgsql(postgresConnectionString);
            options.UseOpenIddict();
            options.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
        });

        services.AddDataProtection();
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddScoped<IAuditTrailService, DatabaseAuditTrailService>();
        services.AddScoped<IWorkerRegistrationKeyService, WorkerRegistrationKeyService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<ISessionManagementService, SessionManagementService>();
        services.AddScoped<IWorkerManagementService, WorkerManagementService>();
        services.AddScoped<IWorkerPresenceStore, RedisWorkerPresenceStore>();
        services.AddSingleton<IManagementEventPublisher, ManagementHubEventPublisher>();

        return services;
    }

    private static string ResolveConnectionString(
        string? configuredValue,
        IConfiguration configuration,
        string appSettingsPropertyName,
        string environmentVariableName)
    {
        var resolvedValue = !string.IsNullOrWhiteSpace(configuredValue)
            ? configuredValue
            : configuration[environmentVariableName];

        return !string.IsNullOrWhiteSpace(resolvedValue)
            ? resolvedValue
            : throw new InvalidOperationException($"Missing required configuration '{GatewayInfrastructureOptions.SectionName}:{appSettingsPropertyName}' or '{environmentVariableName}'.");
    }

    public static async Task InitializeGatewayPersistenceAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<GatewayDbContext>();
        await GatewayDatabaseMigrationBootstrapper.ApplyMigrationsAsync(dbContext);
        await AuditTrailBootstrapper.EnsureTableAsync(dbContext);
    }
}
