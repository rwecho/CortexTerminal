using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.MobileShell.Services;

public sealed class NativeManagementRealtimeService(ILogger<NativeManagementRealtimeService> logger) : IAsyncDisposable
{
    private static readonly TimeSpan ConfigureTimeout = TimeSpan.FromSeconds(10);

    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly JsonSerializerOptions jsonSerializerOptions = new(JsonSerializerDefaults.Web);

    private HubConnection? connection;
    private string? gatewayBaseUrl;
    private string? accessToken;

    public event Action<string>? RawMessageReady;

    public async Task ConfigureAsync(string gatewayBaseUrl, string accessToken, CancellationToken cancellationToken)
    {
        var normalizedGatewayBaseUrl = gatewayBaseUrl.Trim().TrimEnd('/');
        var normalizedAccessToken = accessToken.Trim();

        if (string.IsNullOrWhiteSpace(normalizedGatewayBaseUrl))
        {
            throw new InvalidOperationException("GatewayUrl is required.");
        }

        if (string.IsNullOrWhiteSpace(normalizedAccessToken))
        {
            throw new InvalidOperationException("AccessToken is required.");
        }

        await gate.WaitAsync(cancellationToken);

        try
        {
            logger.LogInformation("[native-management] Configure requested for {GatewayBaseUrl}.", normalizedGatewayBaseUrl);
            PublishLifecycleMessage("connecting");

            var isSameConfiguration = connection is not null
                && string.Equals(this.gatewayBaseUrl, normalizedGatewayBaseUrl, StringComparison.Ordinal)
                && string.Equals(this.accessToken, normalizedAccessToken, StringComparison.Ordinal)
                && connection.State is HubConnectionState.Connected or HubConnectionState.Connecting or HubConnectionState.Reconnecting;

            if (isSameConfiguration)
            {
                logger.LogInformation("[native-management] Reusing existing management realtime connection in state {ConnectionState}.", connection?.State);
                return;
            }

            await DisconnectCoreAsync(CancellationToken.None, clearConfiguration: false);

            this.gatewayBaseUrl = normalizedGatewayBaseUrl;
            this.accessToken = normalizedAccessToken;
            connection = BuildConnection(normalizedGatewayBaseUrl);

            try
            {
                logger.LogInformation("[native-management] Starting SignalR connection to {HubUrl}.", $"{normalizedGatewayBaseUrl}/hubs/management");
                using var configureCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                configureCts.CancelAfter(ConfigureTimeout);

                await connection.StartAsync(configureCts.Token);
                logger.LogInformation("[native-management] SignalR connection started. ConnectionId={ConnectionId}", connection.ConnectionId);
                await connection.InvokeAsync("SubscribeOverview", configureCts.Token);
                logger.LogInformation("[native-management] SubscribeOverview completed.");
                PublishLifecycleMessage("connected");
                PublishInvalidationMessage("nativeConnected");
            }
            catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogError(exception, "[native-management] Timed out while starting or subscribing management realtime client.");
                PublishLifecycleMessage("closed", $"Management realtime connect timed out after {ConfigureTimeout.TotalSeconds:0} seconds.");
                throw new TimeoutException($"Management realtime connect timed out after {ConfigureTimeout.TotalSeconds:0} seconds.", exception);
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "[native-management] Failed to start or subscribe management realtime client.");
                PublishLifecycleMessage("closed", exception.Message);
                throw;
            }
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task DisconnectAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);

        try
        {
            await DisconnectCoreAsync(cancellationToken, clearConfiguration: true);
        }
        finally
        {
            gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync(CancellationToken.None);
        gate.Dispose();
    }

    private HubConnection BuildConnection(string normalizedGatewayBaseUrl)
    {
        var hubConnection = new HubConnectionBuilder()
            .WithUrl($"{normalizedGatewayBaseUrl}/hubs/management", options =>
            {
                options.AccessTokenProvider = () => Task.FromResult(accessToken);
                options.Transports = HttpTransportType.WebSockets;
                options.SkipNegotiation = true;
            })
            .WithAutomaticReconnect([TimeSpan.Zero, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2)])
            .Build();

        hubConnection.KeepAliveInterval = TimeSpan.FromSeconds(2);
        hubConnection.ServerTimeout = TimeSpan.FromSeconds(6);

        hubConnection.On("WorkersChanged", () =>
        {
            logger.LogInformation("[native-management] Received WorkersChanged event.");
            PublishInvalidationMessage("workersChanged");
        });

        hubConnection.On("SessionsChanged", () =>
        {
            logger.LogInformation("[native-management] Received SessionsChanged event.");
            PublishInvalidationMessage("sessionsChanged");
        });

        hubConnection.Reconnecting += error =>
        {
            logger.LogWarning(error, "[native-management] Reconnecting management realtime client.");
            PublishLifecycleMessage("reconnecting", error?.Message);
            return Task.CompletedTask;
        };

        hubConnection.Reconnected += async _ =>
        {
            logger.LogInformation("[native-management] Reconnected management realtime client.");
            await hubConnection.InvokeAsync("SubscribeOverview");
            PublishLifecycleMessage("reconnected");
            PublishInvalidationMessage("reconnected");
        };

        hubConnection.Closed += error =>
        {
            logger.LogWarning(error, "[native-management] Management realtime client closed.");
            PublishLifecycleMessage("closed", error?.Message);
            return Task.CompletedTask;
        };

        return hubConnection;
    }

    private async Task DisconnectCoreAsync(CancellationToken cancellationToken, bool clearConfiguration)
    {
        if (connection is not null)
        {
            try
            {
                if (connection.State != HubConnectionState.Disconnected)
                {
                    await connection.StopAsync(cancellationToken);
                }
            }
            finally
            {
                await connection.DisposeAsync();
                connection = null;
            }

            PublishLifecycleMessage("disconnected");
        }

        if (clearConfiguration)
        {
            gatewayBaseUrl = null;
            accessToken = null;
        }
    }

    private void PublishInvalidationMessage(string reason)
    {
        PublishRawMessage(new
        {
            type = "managementInvalidated",
            payload = new
            {
                reason,
                source = "native",
                observedAtUtc = DateTime.UtcNow
            }
        });
    }

    private void PublishLifecycleMessage(string state, string? error = null)
    {
        PublishRawMessage(new
        {
            type = "managementConnectionState",
            payload = new
            {
                state,
                source = "native",
                error,
                observedAtUtc = DateTime.UtcNow
            }
        });
    }

    public void PublishBridgeError(string state, string error)
    {
        PublishLifecycleMessage(state, error);
    }

    public void PublishBridgeState(string state)
    {
        PublishLifecycleMessage(state);
    }

    private void PublishRawMessage(object payload)
    {
        var json = JsonSerializer.Serialize(payload, jsonSerializerOptions);
        logger.LogInformation("[native-management] Forwarding raw message to HybridWebView: {Payload}", json);
        RawMessageReady?.Invoke(json);
    }
}