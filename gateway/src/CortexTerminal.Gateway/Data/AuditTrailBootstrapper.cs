using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Data;

public static class AuditTrailBootstrapper
{
    public static async Task EnsureTableAsync(GatewayDbContext dbContext, CancellationToken cancellationToken = default)
    {
        const string sql = """
            CREATE TABLE IF NOT EXISTS "AuditEntries" (
                "Id" uuid PRIMARY KEY,
                "Category" character varying(64) NOT NULL,
                "Kind" character varying(64) NOT NULL,
                "Summary" character varying(300) NOT NULL,
                "ActorType" character varying(32),
                "ActorId" character varying(200),
                "SessionId" character varying(120),
                "WorkerId" character varying(120),
                "TraceId" character varying(120),
                "PayloadJson" text,
                "CreatedAtUtc" timestamp with time zone NOT NULL
            );

            CREATE INDEX IF NOT EXISTS "IX_AuditEntries_CreatedAtUtc" ON "AuditEntries" ("CreatedAtUtc" DESC);
            CREATE INDEX IF NOT EXISTS "IX_AuditEntries_Category" ON "AuditEntries" ("Category");
            CREATE INDEX IF NOT EXISTS "IX_AuditEntries_SessionId" ON "AuditEntries" ("SessionId");
            CREATE INDEX IF NOT EXISTS "IX_AuditEntries_WorkerId" ON "AuditEntries" ("WorkerId");
            """;

        await dbContext.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }
}
