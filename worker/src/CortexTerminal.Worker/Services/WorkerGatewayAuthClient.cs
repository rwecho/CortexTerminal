using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Services;

public sealed class WorkerGatewayAuthClient(HttpClient httpClient, ILogger<WorkerGatewayAuthClient> logger)
{
    private const string DeviceCodeGrantType = "urn:cortex:grant-type:worker_device_code";

    public async Task<WorkerDeviceAuthorizationChallenge> StartDeviceAuthorizationAsync(
        string workerId,
        string displayName,
        CancellationToken cancellationToken)
    {
        using var response = await httpClient.PostAsJsonAsync(
            "api/auth/worker/device",
            new StartWorkerDeviceAuthorizationRequest(workerId, displayName, "relay.connect worker.manage offline_access"),
            cancellationToken);

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<WorkerDeviceAuthorizationChallenge>(cancellationToken: cancellationToken);
        return payload ?? throw new InvalidOperationException("Gateway returned an empty worker device authorization response.");
    }

    public async Task<WorkerTokenExchangeResult> ExchangeDeviceCodeAsync(string deviceCode, CancellationToken cancellationToken)
    {
        return await ExchangeTokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = DeviceCodeGrantType,
            ["device_code"] = deviceCode
        }, cancellationToken);
    }

    public async Task<WorkerTokenExchangeResult> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        return await ExchangeTokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken
        }, cancellationToken);
    }

    private async Task<WorkerTokenExchangeResult> ExchangeTokenAsync(
        IReadOnlyDictionary<string, string> formData,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "connect/token")
        {
            Content = new FormUrlEncodedContent(formData)
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            var payload = JsonSerializer.Deserialize<WorkerTokenResponse>(responseBody, JsonSerializerOptions.Web)
                ?? throw new InvalidOperationException("Gateway returned an empty token response.");

            return WorkerTokenExchangeResult.Success(new WorkerAccessToken(
                payload.AccessToken,
                payload.RefreshToken,
                DateTime.UtcNow.AddSeconds(payload.ExpiresIn)));
        }

        var error = TryReadTokenError(responseBody);
        logger.LogWarning(
            "[worker:auth-token-error] StatusCode={StatusCode}, Error={Error}, Description={Description}",
            (int)response.StatusCode,
            error.Error,
            error.ErrorDescription);

        return WorkerTokenExchangeResult.Failure(error.Error, error.ErrorDescription);
    }

    private static OAuthErrorResponse TryReadTokenError(string responseBody)
    {
        try
        {
            return JsonSerializer.Deserialize<OAuthErrorResponse>(responseBody, JsonSerializerOptions.Web)
                ?? new OAuthErrorResponse("invalid_response", responseBody);
        }
        catch
        {
            return new OAuthErrorResponse("invalid_response", responseBody);
        }
    }

    public sealed record WorkerDeviceAuthorizationChallenge(
        string DeviceCode,
        string UserCode,
        string VerificationUri,
        int ExpiresIn,
        int Interval,
        string WorkerId,
        string DisplayName);

    public sealed record WorkerAccessToken(
        string AccessToken,
        string? RefreshToken,
        DateTime ExpiresAtUtc);

    public sealed record WorkerTokenExchangeResult(
        bool IsSuccess,
        WorkerAccessToken? Token,
        string? Error,
        string? ErrorDescription)
    {
        public static WorkerTokenExchangeResult Success(WorkerAccessToken token) => new(true, token, null, null);

        public static WorkerTokenExchangeResult Failure(string? error, string? errorDescription) => new(false, null, error, errorDescription);
    }

    private sealed record StartWorkerDeviceAuthorizationRequest(string WorkerId, string DisplayName, string Scope);

    private sealed record WorkerTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("token_type")] string TokenType,
        [property: JsonPropertyName("expires_in")] int ExpiresIn,
        [property: JsonPropertyName("refresh_token")] string? RefreshToken,
        [property: JsonPropertyName("scope")] string? Scope);

    private sealed record OAuthErrorResponse(string? Error, string? ErrorDescription);
}
