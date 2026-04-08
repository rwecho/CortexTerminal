using Pty.Net;
using System.Threading;

namespace CortexTerminal.Worker.Services.Sessions;

public sealed class WorkerAgentSession(
    string sessionId,
    string displayName,
    string workingDirectory,
    string runtimeCommand,
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

    public DateTimeOffset LastInboundAtUtc => DateTimeOffset.FromUnixTimeMilliseconds(Interlocked.Read(ref lastInboundAtUnixMilliseconds));
    public bool IsClosing => Volatile.Read(ref closeRequested) == 1;

    public void MarkInboundActivity(DateTimeOffset? utcNow = null)
    {
        Interlocked.Exchange(
            ref lastInboundAtUnixMilliseconds,
            (utcNow ?? DateTimeOffset.UtcNow).ToUnixTimeMilliseconds());
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