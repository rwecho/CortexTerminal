namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record WorkerDeviceAuthorizationChallengeResponse(
    string DeviceCode,
    string UserCode,
    string VerificationUri,
    int ExpiresIn,
    int Interval,
    string WorkerId,
    string DisplayName);
