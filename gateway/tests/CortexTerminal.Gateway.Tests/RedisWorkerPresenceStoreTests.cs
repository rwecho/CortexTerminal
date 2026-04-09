using CortexTerminal.Gateway.Services.Workers;

namespace CortexTerminal.Gateway.Tests;

public sealed class RedisWorkerPresenceStoreTests
{
    [Fact]
    public void ParseUtcTimestamp_WithZuluTimestamp_PreservesUtcInstant()
    {
        var parsed = RedisWorkerPresenceStore.ParseUtcTimestamp("2026-04-09T09:22:44.239393Z");

        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
        Assert.Equal(new DateTime(2026, 4, 9, 9, 22, 44, 239, DateTimeKind.Utc).AddTicks(3930), parsed);
    }

    [Fact]
    public void ParseUtcTimestamp_WithOffsetTimestamp_NormalizesToUtc()
    {
        var parsed = RedisWorkerPresenceStore.ParseUtcTimestamp("2026-04-09T17:22:44.239393+08:00");

        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
        Assert.Equal(new DateTime(2026, 4, 9, 9, 22, 44, 239, DateTimeKind.Utc).AddTicks(3930), parsed);
    }
}