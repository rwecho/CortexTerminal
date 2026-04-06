using CortexTerminal.Gateway.Contracts.Users;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Services.Users;

public sealed class UserManagementService(
    GatewayDbContext dbContext,
    UserManager<GatewayUser> userManager) : IUserManagementService
{
    public async Task<IReadOnlyList<GatewayUserResponse>> ListAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .OrderBy(user => user.CreatedAtUtc)
            .Select(user => GatewayUserResponse.FromModel(user))
            .ToListAsync(cancellationToken);
    }

    public async Task<GatewayUserResponse?> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        return user is null ? null : GatewayUserResponse.FromModel(user);
    }

    public async Task<GatewayUserResponse> CreateAsync(CreateGatewayUserRequest request, CancellationToken cancellationToken)
    {
        var username = request.Username.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            throw new InvalidOperationException("Username is required.");
        }

        var normalizedUsername = userManager.NormalizeName(username);
        var exists = await dbContext.Users.AnyAsync(
            user => user.NormalizedUserName == normalizedUsername,
            cancellationToken);

        if (exists)
        {
            throw new InvalidOperationException($"User '{username}' already exists.");
        }

        var utcNow = DateTime.UtcNow;
        var user = new GatewayUser
        {
            Id = Guid.NewGuid(),
            UserName = username,
            NormalizedUserName = normalizedUsername,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            ConcurrencyStamp = Guid.NewGuid().ToString("N")
        };

        var createResult = string.IsNullOrWhiteSpace(request.Password)
            ? await userManager.CreateAsync(user)
            : await userManager.CreateAsync(user, request.Password);

        if (!createResult.Succeeded)
        {
            throw new InvalidOperationException(string.Join(" ", createResult.Errors.Select(error => error.Description)));
        }

        return GatewayUserResponse.FromModel(user);
    }
}
