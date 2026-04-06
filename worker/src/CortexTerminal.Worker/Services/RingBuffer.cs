using System.Collections.Concurrent;

namespace CortexTerminal.Worker.Services;

public sealed class RingBuffer
{
    private readonly int _maxLines;
    private readonly ConcurrentQueue<string> _lines = new();

    public RingBuffer(int maxLines)
    {
        if (maxLines <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxLines), "maxLines must be > 0.");
        }

        _maxLines = maxLines;
    }

    public int Count => _lines.Count;

    public void Append(string line)
    {
        _lines.Enqueue(line);

        while (_lines.Count > _maxLines)
        {
            _lines.TryDequeue(out _);
        }
    }

    public IReadOnlyList<string> Snapshot()
    {
        return _lines.ToArray();
    }
}
