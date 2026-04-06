using CortexTerminal.Worker.Services;

namespace CortexTerminal.Worker.Tests;

public sealed class RingBufferTests
{
    [Fact]
    public void Append_WithinCapacity_KeepsAllLines()
    {
        var buffer = new RingBuffer(3);

        buffer.Append("line-1");
        buffer.Append("line-2");

        var snapshot = buffer.Snapshot();
        Assert.Equal(2, snapshot.Count);
        Assert.Equal("line-1", snapshot[0]);
        Assert.Equal("line-2", snapshot[1]);
    }

    [Fact]
    public void Append_ExceedCapacity_DropsOldestLines()
    {
        var buffer = new RingBuffer(2);

        buffer.Append("line-1");
        buffer.Append("line-2");
        buffer.Append("line-3");

        var snapshot = buffer.Snapshot();
        Assert.Equal(2, snapshot.Count);
        Assert.Equal("line-2", snapshot[0]);
        Assert.Equal("line-3", snapshot[1]);
    }
}
