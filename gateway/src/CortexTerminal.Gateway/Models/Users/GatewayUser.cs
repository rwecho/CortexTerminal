using Microsoft.AspNetCore.Identity;

namespace CortexTerminal.Gateway.Models.Users;

public sealed class GatewayUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
