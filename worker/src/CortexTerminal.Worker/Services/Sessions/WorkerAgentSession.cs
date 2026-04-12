using System.Text;
using System.Threading;
using CortexTerminal.Worker.Services.Runtime;
using Pty.Net;

namespace CortexTerminal.Worker.Services.Sessions;

public sealed class WorkerAgentSession(
    string sessionId,
    string displayName,
    string workingDirectory,
    string runtimeCommand,
    IWorkerRuntimeAdapter runtimeAdapter,
    IPtyConnection connection,
    StreamReader reader,
    Stream writerStream,
    StreamWriter writer,
    SemaphoreSlim commandLock) : IDisposable
{
    public string SessionId { get; } = sessionId;
    public string DisplayName { get; } = displayName;
    public string WorkingDirectory { get; } = workingDirectory;
    public string RuntimeCommand { get; } = runtimeCommand;
    public IWorkerRuntimeAdapter RuntimeAdapter { get; } = runtimeAdapter;
    public IPtyConnection Connection { get; } = connection;
    public StreamReader Reader { get; } = reader;
    public Stream WriterStream { get; } = writerStream;
    public StreamWriter Writer { get; } = writer;
    public SemaphoreSlim CommandLock { get; } = commandLock;
    public DateTimeOffset CreatedAtUtc { get; } = DateTimeOffset.UtcNow;
    public Task? PumpTask { get; set; }
    public string? LastTraceId { get; set; }

    private long lastInboundAtUnixMilliseconds = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    private int closeRequested;
    private int disposeRequested;
    private int runtimeReady;
    private readonly object startupStateLock = new();
    private readonly StringBuilder startupTranscript = new();
    private string? pendingReadyRequestId;
    private string? pendingReadyTraceId;

    public DateTimeOffset LastInboundAtUtc => DateTimeOffset.FromUnixTimeMilliseconds(Interlocked.Read(ref lastInboundAtUnixMilliseconds));
    public bool IsClosing => Volatile.Read(ref closeRequested) == 1;
    public bool IsRuntimeReady => Volatile.Read(ref runtimeReady) == 1;

    public void MarkInboundActivity(DateTimeOffset? utcNow = null)
    {
        Interlocked.Exchange(
            ref lastInboundAtUnixMilliseconds,
            (utcNow ?? DateTimeOffset.UtcNow).ToUnixTimeMilliseconds());
    }

    public void RegisterPendingReady(string? requestId, string? traceId)
    {
        lock (startupStateLock)
        {
            pendingReadyRequestId = requestId;
            pendingReadyTraceId = traceId;
        }
    }

    public (string? RequestId, string? TraceId) GetPendingReady()
    {
        lock (startupStateLock)
        {
            return (pendingReadyRequestId, pendingReadyTraceId);
        }
    }

    public bool ObserveStartupOutput(string chunk)
    {
        if (IsRuntimeReady)
        {
            return false;
        }

        if (!RuntimeAdapter.RequiresPromptReadiness)
        {
            return TryMarkRuntimeReady();
        }

        lock (startupStateLock)
        {
            startupTranscript.Append(chunk);
            const int maxStartupTranscriptLength = 16000;
            if (startupTranscript.Length > maxStartupTranscriptLength)
            {
                startupTranscript.Remove(0, startupTranscript.Length - maxStartupTranscriptLength);
            }

            var transcript = startupTranscript.ToString();
            if (RuntimeAdapter.IsPromptReady(transcript))
            {
                return TryMarkRuntimeReady();
            }

            if (RuntimeAdapter.PromptReadyFallbackDelay > TimeSpan.Zero
                && !RuntimeAdapter.IsPromptBlocked(transcript)
                && DateTimeOffset.UtcNow - CreatedAtUtc >= RuntimeAdapter.PromptReadyFallbackDelay)
            {
                return TryMarkRuntimeReady();
            }
        }

        return false;
    }

    public bool TryMarkRuntimeReadyByFallback(DateTimeOffset? utcNow = null)
    {
        if (IsRuntimeReady || !RuntimeAdapter.RequiresPromptReadiness)
        {
            return false;
        }

        lock (startupStateLock)
        {
            var transcript = startupTranscript.ToString();
            if (string.IsNullOrWhiteSpace(transcript))
            {
                return false;
            }

            if (RuntimeAdapter.IsPromptReady(transcript))
            {
                return TryMarkRuntimeReady();
            }

            if (RuntimeAdapter.PromptReadyFallbackDelay <= TimeSpan.Zero
                || RuntimeAdapter.IsPromptBlocked(transcript)
                || (utcNow ?? DateTimeOffset.UtcNow) - CreatedAtUtc < RuntimeAdapter.PromptReadyFallbackDelay)
            {
                return false;
            }

            return TryMarkRuntimeReady();
        }
    }

    public bool TryMarkRuntimeReady()
    {
        return Interlocked.Exchange(ref runtimeReady, 1) == 0;
    }

    public bool TryMarkClosing()
    {
        return Interlocked.Exchange(ref closeRequested, 1) == 0;
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposeRequested, 1) == 1)
        {
            return;
        }

        try
        {
            Writer.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            Reader.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            WriterStream.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            Connection.Dispose();
        }
        catch
        {
            // ignore
        }

        CommandLock.Dispose();
    }
}
