using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Data;

public static class GatewayDatabaseMigrationBootstrapper
{
    public static async Task ApplyMigrationsAsync(GatewayDbContext dbContext, CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}