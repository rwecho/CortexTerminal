using System.Collections.Concurrent;
using System.Text;
using CortexTerminal.Worker.Services.Runtime;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;
using Pty.Net;

namespace CortexTerminal.Worker.Services.Sessions;

public sealed class WorkerSessionCoordinator(
    GatewayManagementClient gatewayManagementClient,
    HubConnection connection,
    ILogger logger,
    string workerId,
    string workerModelName,
    string workerRuntimeCommand,
    IReadOnlyList<string> availablePaths) : IDisposable
{
    private readonly ConcurrentDictionary<string, WorkerAgentSession> sessions = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim creationLock = new(1, 1);

    public async Task<WorkerAgentSession?> GetOrCreateSessionAsync(
        string sessionId,
        string? requestId,
        string? traceId,
        CancellationToken cancellationToken)
    {
        if (sessions.TryGetValue(sessionId, out var existingSession))
        {
            return existingSession;
        }

        await creationLock.WaitAsync(cancellationToken);
        var sessionRuntimeCommand = workerRuntimeCommand;
        try
        {
            if (sessions.TryGetValue(sessionId, out existingSession))
            {
                return existingSession;
            }

            var sessionSnapshot = await gatewayManagementClient.GetSessionAsync(sessionId, cancellationToken);
            var workingDirectory = ResolveWorkingDirectory(sessionSnapshot?.WorkingDirectory, availablePaths, workerId);
            sessionRuntimeCommand = WorkerRuntimeCatalog.ResolveRuntimeCommandForSession(sessionSnapshot?.AgentFamily, workerRuntimeCommand);
            var runtimeAdapter = WorkerRuntimeAdapterRegistry.Resolve(sessionSnapshot?.AgentFamily, sessionRuntimeCommand);
            var launchPlan = runtimeAdapter.BuildFreshPlan(
                new WorkerRuntimeLaunchRequest(
                    runtimeAdapter.AgentFamily,
                    sessionRuntimeCommand,
                    workingDirectory));

            var ptyConnection = await PtyProvider.SpawnAsync(launchPlan.ToPtyOptions(), cancellationToken);
            var session = new WorkerAgentSession(
                sessionId,
                string.IsNullOrWhiteSpace(sessionSnapshot?.DisplayName) ? sessionId : sessionSnapshot.DisplayName.Trim(),
                workingDirectory,
                sessionRuntimeCommand,
                ptyConnection,
                new StreamReader(ptyConnection.ReaderStream, Encoding.UTF8, false, 1024, leaveOpen: true),
                ptyConnection.WriterStream,
                new StreamWriter(ptyConnection.WriterStream, new UTF8Encoding(false)) { AutoFlush = true },
                new SemaphoreSlim(1, 1));

            sessions[sessionId] = session;

            session.PumpTask = Task.Run(async () =>
            {
                await PumpSessionOutputAsync(sessionId, session, cancellationToken);
            }, cancellationToken);

            logger.LogInformation(
                "[worker:agent-session-ready] SessionId={SessionId}, Runtime={Runtime}, ModelName={ModelName}, WorkingDirectory={WorkingDirectory}, AgentFamily={AgentFamily}, Shell={Shell}, Entrypoint={Entrypoint}",
                sessionId,
                sessionRuntimeCommand,
                workerModelName,
                workingDirectory,
                sessionSnapshot?.AgentFamily,
                launchPlan.ShellApp,
                launchPlan.EntrypointPath);
            await RelayTextFrameAsync(
                sessionId,
                $"__ct_ready__:{workingDirectory}\r\n",
                requestId,
                traceId,
                cancellationToken);
            return session;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[worker:pty-create-failed] SessionId={SessionId}, Runtime={Runtime}, ModelName={ModelName}", sessionId, sessionRuntimeCommand, workerModelName);
            return null;
        }
        finally
        {
            creationLock.Release();
        }
    }

    public async Task SendInputAsync(WorkerAgentSession session, string input, CancellationToken cancellationToken)
    {
        await session.CommandLock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrEmpty(input))
            {
                foreach (var character in input)
                {
                    var keyBytes = Encoding.UTF8.GetBytes(character.ToString());
                    await session.WriterStream.WriteAsync(keyBytes, cancellationToken);
                    await session.WriterStream.FlushAsync(cancellationToken);
                    await Task.Delay(5, cancellationToken);
                }

                await Task.Delay(20, cancellationToken);
            }

            await session.WriterStream.WriteAsync(new byte[] { 0x0D }, cancellationToken);
            await session.WriterStream.FlushAsync(cancellationToken);
        }
        finally
        {
            session.CommandLock.Release();
        }
    }

    public void MarkInboundActivity(WorkerAgentSession session, string? traceId)
    {
        session.MarkInboundActivity();
        if (!string.IsNullOrWhiteSpace(traceId))
        {
            session.LastTraceId = traceId;
        }
    }

    public async Task RelayTextFrameAsync(
        string sessionId,
        string text,
        string? requestId,
        string? traceId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
        logger.LogInformation(
            "[relay-worker->gateway:send] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, Base64Length={Base64Length}, PlaintextLength={PlaintextLength}",
            sessionId,
            requestId,
            traceId,
            payloadBase64.Length,
            text.Length);
        logger.LogDebug(
            "[relay-worker->gateway:send:text] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadText={PayloadText}",
            sessionId,
            requestId,
            traceId,
            text);

        await connection.InvokeAsync("RelayFromWorker", sessionId, payloadBase64, requestId, traceId, cancellationToken);
    }

    public void Dispose()
    {
        foreach (var session in sessions.Values)
        {
            try
            {
                session.Dispose();
            }
            catch
            {
                // ignore cleanup errors
            }
        }

        creationLock.Dispose();
    }

    public async Task RunMaintenanceLoopAsync(
        WorkerSessionMaintenanceOptions options,
        CancellationToken cancellationToken)
    {
        if (!options.IsEnabled)
        {
            logger.LogInformation("[worker:session-maintenance-disabled]");
            return;
        }

        logger.LogInformation(
            "[worker:session-maintenance-start] IdleTimeout={IdleTimeout}, DisconnectedGracePeriod={DisconnectedGracePeriod}, SweepInterval={SweepInterval}, CloseGatewaySessionOnCleanup={CloseGatewaySessionOnCleanup}",
            options.IdleTimeout,
            options.DisconnectedGracePeriod,
            options.SweepInterval,
            options.CloseGatewaySessionOnCleanup);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await SweepSessionsAsync(options, cancellationToken);
                await Task.Delay(options.SweepInterval, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[worker:session-maintenance-error]");
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            }
        }
    }

    private static string ResolveWorkingDirectory(string? requestedWorkingDirectory, IReadOnlyList<string> availablePaths, string workerId)
    {
        var fallbackPath = availablePaths.Count > 0
            ? availablePaths[0]
            : Path.GetFullPath(Environment.CurrentDirectory);

        if (string.IsNullOrWhiteSpace(requestedWorkingDirectory))
        {
            return fallbackPath;
        }

        var normalizedRequestedPath = Path.GetFullPath(requestedWorkingDirectory);
        if (availablePaths.Count > 0 && !availablePaths.Contains(normalizedRequestedPath, StringComparer.Ordinal))
        {
            throw new InvalidOperationException($"Working directory '{normalizedRequestedPath}' is not allowed on worker '{workerId}'.");
        }

        if (!Directory.Exists(normalizedRequestedPath))
        {
            throw new DirectoryNotFoundException($"Working directory '{normalizedRequestedPath}' does not exist.");
        }

        return normalizedRequestedPath;
    }

    private async Task SweepSessionsAsync(
        WorkerSessionMaintenanceOptions options,
        CancellationToken cancellationToken)
    {
        foreach (var entry in sessions.ToArray())
        {
            var session = entry.Value;
            if (session.IsClosing)
            {
                continue;
            }

            GatewayManagementClient.GatewaySessionSnapshot? gatewaySnapshot;
            try
            {
                gatewaySnapshot = await gatewayManagementClient.GetSessionAsync(session.SessionId, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[worker:session-maintenance-snapshot-failed] SessionId={SessionId}", session.SessionId);
                continue;
            }

            var decision = WorkerSessionCleanupPolicy.Evaluate(
                session,
                gatewaySnapshot,
                options,
                DateTimeOffset.UtcNow);
            if (!decision.ShouldCleanup)
            {
                continue;
            }

            await CleanupSessionAsync(session, decision, cancellationToken);
        }
    }

    private async Task CleanupSessionAsync(
        WorkerAgentSession session,
        WorkerSessionCleanupDecision decision,
        CancellationToken cancellationToken)
    {
        if (!session.TryMarkClosing())
        {
            return;
        }

        sessions.TryRemove(session.SessionId, out _);
        logger.LogInformation(
            "[worker:session-cleanup] SessionId={SessionId}, Reason={ReasonCode}, Message={ReasonMessage}, LastInboundAtUtc={LastInboundAtUtc}",
            session.SessionId,
            decision.ReasonCode,
            decision.ReasonMessage,
            session.LastInboundAtUtc);

        try
        {
            await RelayTextFrameAsync(
                session.SessionId,
                $"\r\n[worker] session cleanup triggered: {decision.ReasonCode}. closing PTY to keep worker healthy.\r\n",
                null,
                session.LastTraceId,
                cancellationToken);
        }
        catch
        {
            // Mobile may already be disconnected; ignore notification failure.
        }

        if (decision.CloseGatewaySession)
        {
            try
            {
                await gatewayManagementClient.CloseSessionAsync(session.SessionId, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[worker:session-cleanup-close-failed] SessionId={SessionId}", session.SessionId);
            }
        }

        session.Dispose();
    }

    private async Task PumpSessionOutputAsync(string sessionId, WorkerAgentSession session, CancellationToken cancellationToken, int bufferSize = 2048)
    {
        try
        {
            var buffer = new char[bufferSize];
            while (!cancellationToken.IsCancellationRequested)
            {
                var read = await session.Reader.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
                if (read <= 0)
                {
                    break;
                }

                var chunk = new string(buffer, 0, read);
                if (!string.IsNullOrEmpty(chunk))
                {
                    await RelayTextFrameAsync(sessionId, chunk, null, session.LastTraceId, cancellationToken);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // expected on shutdown
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[worker:agent-pump-failed] SessionId={SessionId}", sessionId);
            try
            {
                await RelayTextFrameAsync(
                    sessionId,
                    "__ct_error__:Agent session disconnected unexpectedly.\r\n",
                    null,
                    session.LastTraceId,
                    cancellationToken);
            }
            catch
            {
                // ignore relay error during failure path
            }
        }
        finally
        {
            sessions.TryRemove(sessionId, out _);
            try
            {
                session.Dispose();
            }
            catch
            {
                // ignore
            }

            logger.LogInformation("[worker:agent-session-ended] SessionId={SessionId}", sessionId);
        }
    }
}