using System.Net.Http.Json;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Services;

public sealed class GatewayManagementClient(
    HttpClient httpClient,
    Func<CancellationToken, Task<string>> accessTokenProvider,
    ILogger<GatewayManagementClient> logger)
{
    public async Task UpsertWorkerAsync(
        string workerId,
        string displayName,
        string modelName,
        IReadOnlyList<string> availablePaths,
        IReadOnlyList<string> supportedAgentFamilies,
        CancellationToken cancellationToken)
    {
        using var request = await CreateJsonRequestAsync(
            HttpMethod.Post,
            "api/workers",
            new UpsertWorkerRequest(workerId, displayName, modelName, availablePaths, supportedAgentFamilies),
            cancellationToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        response.EnsureSuccessStatusCode();
        logger.LogInformation(
            "[worker:management-upsert] WorkerId={WorkerId}, PathCount={PathCount}",
            workerId,
            availablePaths.Count);
    }

    public async Task RecordHeartbeatAsync(string workerId, CancellationToken cancellationToken)
    {
        using var request = await CreateRequestAsync(
            HttpMethod.Post,
            $"api/workers/{Uri.EscapeDataString(workerId)}/heartbeat",
            cancellationToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);

        response.EnsureSuccessStatusCode();
        logger.LogDebug("[worker:heartbeat] WorkerId={WorkerId}", workerId);
    }

    public async Task<GatewaySessionSnapshot?> GetSessionAsync(string sessionId, CancellationToken cancellationToken)
    {
        using var request = await CreateRequestAsync(
            HttpMethod.Get,
            $"api/sessions/{Uri.EscapeDataString(sessionId)}",
            cancellationToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<GatewaySessionSnapshot>(cancellationToken: cancellationToken);
    }

    public async Task CloseSessionAsync(string sessionId, CancellationToken cancellationToken)
    {
        using var request = await CreateRequestAsync(
            HttpMethod.Post,
            $"api/sessions/{Uri.EscapeDataString(sessionId)}/close",
            cancellationToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return;
        }

        response.EnsureSuccessStatusCode();
        logger.LogInformation("[worker:management-close-session] SessionId={SessionId}", sessionId);
    }

    public sealed record GatewaySessionSnapshot(
        string SessionId,
        string? WorkerId,
        string? DisplayName,
        string? AgentFamily,
        string? WorkingDirectory,
        string? State,
        string? MobileConnectionId,
        string? TraceId,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc,
        DateTime? LastActivityAtUtc,
        bool IsActive);

    private async Task<HttpRequestMessage> CreateRequestAsync(
        HttpMethod method,
        string requestUri,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer",
            await accessTokenProvider(cancellationToken));
        return request;
    }

    private async Task<HttpRequestMessage> CreateJsonRequestAsync<T>(
        HttpMethod method,
        string requestUri,
        T payload,
        CancellationToken cancellationToken)
    {
        var request = await CreateRequestAsync(method, requestUri, cancellationToken);
        request.Content = JsonContent.Create(payload);
        return request;
    }

    private sealed record UpsertWorkerRequest(
        string WorkerId,
        string DisplayName,
        string ModelName,
        IReadOnlyList<string> AvailablePaths,
        IReadOnlyList<string> SupportedAgentFamilies);
}
