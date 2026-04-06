using CortexTerminal.Gateway.Models.Users;

namespace CortexTerminal.Gateway.Contracts.Users;

public sealed record GatewayUserResponse(
    Guid Id,
    string Username,
    string DisplayName,
    string? Email,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc)
{
    public static GatewayUserResponse FromModel(GatewayUser user)
    {
        return new GatewayUserResponse(
            user.Id,
            user.UserName ?? string.Empty,
            user.DisplayName,
            user.Email,
            user.CreatedAtUtc,
            user.UpdatedAtUtc);
    }
}
