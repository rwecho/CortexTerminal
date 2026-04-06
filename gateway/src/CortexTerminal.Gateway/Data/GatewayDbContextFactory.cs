using CortexTerminal.Gateway.Configuration;
using CortexTerminal.Gateway.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace CortexTerminal.Gateway.Data;

public sealed class GatewayDbContextFactory : IDesignTimeDbContextFactory<GatewayDbContext>
{
    public GatewayDbContext CreateDbContext(string[] args)
    {
        GatewayEnvironmentLoader.LoadFromRepositoryRoot();

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var infrastructureOptions = configuration
            .GetSection(GatewayInfrastructureOptions.SectionName)
            .Get<GatewayInfrastructureOptions>()
            ?? new GatewayInfrastructureOptions();

        var postgresConnectionString = !string.IsNullOrWhiteSpace(infrastructureOptions.PostgresConnectionString)
            ? infrastructureOptions.PostgresConnectionString
            : configuration[GatewayInfrastructureOptions.PostgresConnectionStringName]
                ?? throw new InvalidOperationException(
                    $"Missing required configuration '{GatewayInfrastructureOptions.SectionName}:{nameof(GatewayInfrastructureOptions.PostgresConnectionString)}' or '{GatewayInfrastructureOptions.PostgresConnectionStringName}'.");

        var optionsBuilder = new DbContextOptionsBuilder<GatewayDbContext>();
        optionsBuilder.UseNpgsql(postgresConnectionString);
        optionsBuilder.UseOpenIddict();

        return new GatewayDbContext(optionsBuilder.Options);
    }
}