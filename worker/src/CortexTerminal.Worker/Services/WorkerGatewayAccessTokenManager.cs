using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Services;

public sealed class WorkerGatewayAccessTokenManager(
    WorkerGatewayAuthClient authClient,
    ILogger<WorkerGatewayAccessTokenManager> logger,
    string workerId,
    string displayName,
    string cacheFilePath)
{
    private static readonly TimeSpan RefreshSkew = TimeSpan.FromMinutes(2);
    private readonly SemaphoreSlim gate = new(1, 1);
    private WorkerGatewayAuthClient.WorkerAccessToken? currentToken;

    public async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (HasUsableToken(currentToken))
        {
            return currentToken!.AccessToken;
        }

        await gate.WaitAsync(cancellationToken);
        try
        {
            if (HasUsableToken(currentToken))
            {
                return currentToken!.AccessToken;
            }

            currentToken ??= await LoadCachedTokenAsync(cancellationToken);
            if (HasUsableToken(currentToken))
            {
                return currentToken!.AccessToken;
            }

            if (!string.IsNullOrWhiteSpace(currentToken?.RefreshToken))
            {
                var refreshResult = await authClient.RefreshTokenAsync(currentToken.RefreshToken!, cancellationToken);
                if (refreshResult.IsSuccess)
                {
                    currentToken = refreshResult.Token;
                    await SaveTokenAsync(currentToken!, cancellationToken);
                    logger.LogInformation("[worker:auth-refresh-success] WorkerId={WorkerId}", workerId);
                    return currentToken!.AccessToken;
                }

                logger.LogWarning(
                    "[worker:auth-refresh-failed] WorkerId={WorkerId}, Error={Error}",
                    workerId,
                    refreshResult.Error);
                currentToken = null;
                await DeleteTokenCacheIfExistsAsync(cancellationToken);
            }

            currentToken = await AuthorizeDeviceAsync(cancellationToken);
            await SaveTokenAsync(currentToken, cancellationToken);
            return currentToken.AccessToken;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<WorkerGatewayAuthClient.WorkerAccessToken> AuthorizeDeviceAsync(CancellationToken cancellationToken)
    {
        var challenge = await authClient.StartDeviceAuthorizationAsync(workerId, displayName, cancellationToken);

        logger.LogWarning(
            "[worker:device-auth-required] WorkerId={WorkerId}, UserCode={UserCode}, VerificationUri={VerificationUri}",
            workerId,
            challenge.UserCode,
            challenge.VerificationUri);

        Console.WriteLine();
        Console.WriteLine("=== Cortex Worker Device Pairing ===");
        Console.WriteLine($"Worker: {challenge.DisplayName} ({challenge.WorkerId})");
        Console.WriteLine($"Pairing code: {challenge.UserCode}");
        Console.WriteLine("请在已登录的 mobile 里输入这个 Pairing Code 完成授权。");
        Console.WriteLine();

        var pollingDelay = TimeSpan.FromSeconds(Math.Max(1, challenge.Interval));
        var expiresAtUtc = DateTime.UtcNow.AddSeconds(Math.Max(30, challenge.ExpiresIn));

        while (DateTime.UtcNow < expiresAtUtc)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var exchangeResult = await authClient.ExchangeDeviceCodeAsync(challenge.DeviceCode, cancellationToken);
            if (exchangeResult.IsSuccess)
            {
                logger.LogInformation("[worker:device-auth-approved] WorkerId={WorkerId}", workerId);
                return exchangeResult.Token!;
            }

            if (string.Equals(exchangeResult.Error, "authorization_pending", StringComparison.Ordinal))
            {
                await Task.Delay(pollingDelay, cancellationToken);
                continue;
            }

            if (string.Equals(exchangeResult.Error, "slow_down", StringComparison.Ordinal))
            {
                pollingDelay += TimeSpan.FromSeconds(5);
                await Task.Delay(pollingDelay, cancellationToken);
                continue;
            }

            if (string.Equals(exchangeResult.Error, "expired_token", StringComparison.Ordinal))
            {
                break;
            }

            throw new InvalidOperationException(
                $"Worker device authorization failed: {exchangeResult.Error ?? "unknown_error"} - {exchangeResult.ErrorDescription}");
        }

        throw new InvalidOperationException("Worker device authorization expired before approval completed.");
    }

    private async Task<WorkerGatewayAuthClient.WorkerAccessToken?> LoadCachedTokenAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(cacheFilePath))
        {
            return null;
        }

        await using var stream = File.OpenRead(cacheFilePath);
        var payload = await JsonSerializer.DeserializeAsync<WorkerGatewayTokenCache>(stream, JsonSerializerOptions.Web, cancellationToken);
        if (payload is null)
        {
            return null;
        }

        logger.LogInformation("[worker:auth-cache-loaded] WorkerId={WorkerId}, CachePath={CachePath}", workerId, cacheFilePath);
        return new WorkerGatewayAuthClient.WorkerAccessToken(payload.AccessToken, payload.RefreshToken, payload.ExpiresAtUtc);
    }

    private async Task SaveTokenAsync(WorkerGatewayAuthClient.WorkerAccessToken token, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(cacheFilePath) ?? ".");
        await using var stream = File.Create(cacheFilePath);
        await JsonSerializer.SerializeAsync(
            stream,
            new WorkerGatewayTokenCache(token.AccessToken, token.RefreshToken, token.ExpiresAtUtc),
            JsonSerializerOptions.Web,
            cancellationToken);
    }

    private async Task DeleteTokenCacheIfExistsAsync(CancellationToken cancellationToken)
    {
        await Task.Yield();
        cancellationToken.ThrowIfCancellationRequested();
        if (File.Exists(cacheFilePath))
        {
            File.Delete(cacheFilePath);
        }
    }

    private static bool HasUsableToken(WorkerGatewayAuthClient.WorkerAccessToken? token)
    {
        return token is not null && token.ExpiresAtUtc > DateTime.UtcNow.Add(RefreshSkew);
    }

    public static string ResolveDefaultCachePath(string gatewayBaseUrl, string workerId)
    {
        var gatewayUri = new Uri(gatewayBaseUrl);
        var baseDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".cortex-terminal",
            "worker-auth");
        var fileName = $"{SanitizeFileName(gatewayUri.Host)}-{SanitizeFileName(workerId)}.json";
        return Path.Combine(baseDirectory, fileName);
    }

    private static string SanitizeFileName(string value)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var buffer = value.Select(character => invalidChars.Contains(character) ? '-' : character).ToArray();
        return new string(buffer);
    }

    private sealed record WorkerGatewayTokenCache(
        string AccessToken,
        string? RefreshToken,
        DateTime ExpiresAtUtc);
}
