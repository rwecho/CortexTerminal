using CortexTerminal.Gateway.Models.Sessions;

namespace CortexTerminal.Gateway.Contracts.Sessions;

public sealed record GatewaySessionResponse(
    string SessionId,
    Guid? UserId,
    string? WorkerId,
    string? DisplayName,
    string? WorkingDirectory,
    SessionLifecycleState State,
    string? MobileConnectionId,
    string? TraceId,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    DateTime? LastActivityAtUtc,
    bool IsActive)
{
    public static GatewaySessionResponse FromModel(GatewaySessionRecord session, bool isActive)
    {
        return new GatewaySessionResponse(
            session.SessionId,
            session.UserId,
            session.WorkerId,
            session.DisplayName,
            session.WorkingDirectory,
            session.State,
            session.MobileConnectionId,
            session.TraceId,
            session.CreatedAtUtc,
            session.UpdatedAtUtc,
            session.LastActivityAtUtc,
            isActive);
    }
}
