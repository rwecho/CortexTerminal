using System.Text.Json.Serialization;

namespace CortexTerminal.Gateway.Contracts.Workers;

public sealed class WorkerDirectoryEntryResponse
{
    [JsonPropertyName("path")]
    public string? Path { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("hasChildren")]
    public bool HasChildren { get; set; }

    [JsonPropertyName("isRoot")]
    public bool IsRoot { get; set; }
}
