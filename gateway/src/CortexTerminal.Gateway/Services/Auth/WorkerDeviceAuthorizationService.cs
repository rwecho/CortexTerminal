using System.Security.Cryptography;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Auth;
using CortexTerminal.Gateway.Models.Users;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Services.Auth;

public sealed class WorkerDeviceAuthorizationService(GatewayDbContext dbContext) : IWorkerDeviceAuthorizationService
{
    private static readonly string[] DefaultScopes = ["relay.connect", "worker.manage", "offline_access"];
    private const int ExpiresInSeconds = 900;
    private const int PollingIntervalSeconds = 5;

    public async Task<WorkerDeviceAuthorizationRecord> CreateChallengeAsync(
        string workerId,
        string displayName,
        IReadOnlyCollection<string> requestedScopes,
        CancellationToken cancellationToken)
    {
        var normalizedWorkerId = workerId.Trim();
        if (string.IsNullOrWhiteSpace(normalizedWorkerId))
        {
            throw new InvalidOperationException("WorkerId is required.");
        }

        var normalizedDisplayName = string.IsNullOrWhiteSpace(displayName)
            ? normalizedWorkerId
            : displayName.Trim();

        var utcNow = DateTime.UtcNow;
        var record = new WorkerDeviceAuthorizationRecord
        {
            Id = Guid.NewGuid(),
            DeviceCode = CreateRandomToken(48),
            UserCode = await GenerateUniqueUserCodeAsync(cancellationToken),
            WorkerId = normalizedWorkerId,
            WorkerDisplayName = normalizedDisplayName,
            RequestedScopes = string.Join(' ', NormalizeScopes(requestedScopes)),
            Status = WorkerDeviceAuthorizationStatus.Pending,
            CreatedAtUtc = utcNow,
            ExpiresAtUtc = utcNow.AddSeconds(ExpiresInSeconds),
            PollingIntervalSeconds = PollingIntervalSeconds
        };

        dbContext.Set<WorkerDeviceAuthorizationRecord>().Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return record;
    }

    public async Task<WorkerDeviceAuthorizationRecord?> ApproveAsync(
        string userCode,
        GatewayUser approver,
        CancellationToken cancellationToken)
    {
        var normalizedUserCode = NormalizeUserCode(userCode);
        if (string.IsNullOrWhiteSpace(normalizedUserCode))
        {
            return null;
        }

        var record = await dbContext.Set<WorkerDeviceAuthorizationRecord>()
            .SingleOrDefaultAsync(item => item.UserCode == normalizedUserCode, cancellationToken);

        if (record is null)
        {
            return null;
        }

        if (record.ExpiresAtUtc <= DateTime.UtcNow)
        {
            record.Status = WorkerDeviceAuthorizationStatus.Expired;
            await dbContext.SaveChangesAsync(cancellationToken);
            return null;
        }

        if (record.Status is WorkerDeviceAuthorizationStatus.Redeemed or WorkerDeviceAuthorizationStatus.Denied)
        {
            return null;
        }

        record.Status = WorkerDeviceAuthorizationStatus.Approved;
        record.ApprovedAtUtc = DateTime.UtcNow;
        record.ApprovedByUserId = approver.Id;
        record.ApprovedByDisplayName = string.IsNullOrWhiteSpace(approver.DisplayName)
            ? approver.UserName
            : approver.DisplayName;

        await dbContext.SaveChangesAsync(cancellationToken);
        return record;
    }

    public async Task<WorkerDeviceAuthorizationRecord?> RedeemApprovedChallengeAsync(
        string deviceCode,
        CancellationToken cancellationToken)
    {
        var normalizedDeviceCode = deviceCode.Trim();
        if (string.IsNullOrWhiteSpace(normalizedDeviceCode))
        {
            return null;
        }

        var record = await dbContext.Set<WorkerDeviceAuthorizationRecord>()
            .SingleOrDefaultAsync(item => item.DeviceCode == normalizedDeviceCode, cancellationToken);

        if (record is null)
        {
            return null;
        }

        record.LastPolledAtUtc = DateTime.UtcNow;

        if (record.ExpiresAtUtc <= DateTime.UtcNow)
        {
            record.Status = WorkerDeviceAuthorizationStatus.Expired;
            await dbContext.SaveChangesAsync(cancellationToken);
            return record;
        }

        if (record.Status != WorkerDeviceAuthorizationStatus.Approved)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return record;
        }

        record.Status = WorkerDeviceAuthorizationStatus.Redeemed;
        record.RedeemedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return record;
    }

    private async Task<string> GenerateUniqueUserCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var candidate = CreateUserCode();
            var exists = await dbContext.Set<WorkerDeviceAuthorizationRecord>()
                .AnyAsync(item => item.UserCode == candidate && item.ExpiresAtUtc > DateTime.UtcNow, cancellationToken);

            if (!exists)
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Unable to generate a unique worker pairing code.");
    }

    private static IReadOnlyList<string> NormalizeScopes(IReadOnlyCollection<string> requestedScopes)
    {
        var scopes = requestedScopes.Count > 0
            ? requestedScopes
                .Where(scope => !string.IsNullOrWhiteSpace(scope))
                .Select(scope => scope.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToArray()
            : [];

        return scopes.Length > 0 ? scopes : DefaultScopes;
    }

    private static string NormalizeUserCode(string userCode)
    {
        return userCode.Trim().ToUpperInvariant();
    }

    private static string CreateUserCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Span<char> buffer = stackalloc char[9];
        buffer[4] = '-';

        var randomBytes = RandomNumberGenerator.GetBytes(8);
        var writeIndex = 0;
        for (var index = 0; index < randomBytes.Length; index++)
        {
            if (writeIndex == 4)
            {
                writeIndex++;
            }

            buffer[writeIndex++] = alphabet[randomBytes[index] % alphabet.Length];
        }

        return new string(buffer);
    }

    private static string CreateRandomToken(int byteLength)
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(byteLength))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
