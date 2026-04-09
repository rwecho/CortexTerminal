using System.Security.Cryptography;
using System.Text.Json;
using CortexTerminal.Gateway.Models.Users;
using Microsoft.AspNetCore.Identity;
using StackExchange.Redis;

namespace CortexTerminal.Gateway.Services.Auth;

public sealed class WorkerInstallTokenService(
    IConnectionMultiplexer connectionMultiplexer,
    UserManager<GatewayUser> userManager) : IWorkerInstallTokenService
{
    private const string TokenPrefix = "iwk_";
    private const string TokenAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int TokenLength = 8;
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(10);
    private readonly IDatabase database = connectionMultiplexer.GetDatabase();

    public async Task<WorkerInstallTokenIssueResult> IssueAsync(GatewayUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        for (var attempt = 0; attempt < 8; attempt += 1)
        {
            var issuedAtUtc = DateTime.UtcNow;
            var expiresAtUtc = issuedAtUtc.Add(TokenLifetime);
            var token = TokenPrefix + GenerateTokenSuffix(TokenLength);
            var payload = JsonSerializer.Serialize(new WorkerInstallTokenPayload(user.Id, issuedAtUtc, expiresAtUtc));
            var stored = await database.StringSetAsync(
                BuildRedisKey(token),
                payload,
                expiresAtUtc - issuedAtUtc,
                when: When.NotExists);

            if (stored)
            {
                return new WorkerInstallTokenIssueResult(token, issuedAtUtc, expiresAtUtc, user);
            }
        }

        throw new InvalidOperationException("Unable to issue a unique worker install token.");
    }

    public async Task<WorkerInstallTokenConsumeResult?> ConsumeAsync(string token, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedToken = token.Trim();
        if (string.IsNullOrWhiteSpace(normalizedToken)
            || !normalizedToken.StartsWith(TokenPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var payloadJson = await database.StringGetAsync(BuildRedisKey(normalizedToken));
        if (payloadJson.IsNullOrEmpty)
        {
            return null;
        }

        WorkerInstallTokenPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<WorkerInstallTokenPayload>(payloadJson.ToString());
        }
        catch
        {
            return null;
        }

        if (payload is null || payload.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return null;
        }

        var user = await userManager.FindByIdAsync(payload.UserId.ToString());
        return user is null
            ? null
            : new WorkerInstallTokenConsumeResult(normalizedToken, payload.IssuedAtUtc, payload.ExpiresAtUtc, user);
    }

    private static string BuildRedisKey(string token) => $"gateway:worker-install-token:{token}";

    private static string GenerateTokenSuffix(int length)
    {
        Span<byte> randomBytes = stackalloc byte[length];
        RandomNumberGenerator.Fill(randomBytes);
        var buffer = new char[length];

        for (var index = 0; index < length; index += 1)
        {
            buffer[index] = TokenAlphabet[randomBytes[index] % TokenAlphabet.Length];
        }

        return new string(buffer);
    }

    private sealed record WorkerInstallTokenPayload(
        Guid UserId,
        DateTime IssuedAtUtc,
        DateTime ExpiresAtUtc);
}
