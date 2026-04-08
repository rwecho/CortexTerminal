namespace CortexTerminal.Gateway.Contracts.Workers;

public sealed record UpsertWorkerRequest(
    string WorkerId,
    string? DisplayName,
    string? ModelName,
    IReadOnlyList<string>? AvailablePaths,
    IReadOnlyList<string>? SupportedAgentFamilies);
