using System.Text.Json.Serialization;

namespace CortexTerminal.Worker.Services.Sessions;

public sealed class WorkerDirectoryBrowseResponse
{
    [JsonPropertyName("workerId")]
    public string? WorkerId { get; set; }

    [JsonPropertyName("requestedPath")]
    public string? RequestedPath { get; set; }

    [JsonPropertyName("entries")]
    public IReadOnlyList<WorkerDirectoryEntryResponse> Entries { get; set; } = [];
}
