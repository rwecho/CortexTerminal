using System.Text.Json;
using CortexTerminal.Gateway.Models.Users;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;

namespace CortexTerminal.Gateway.Services.Auth;

public sealed class WorkerRegistrationKeyService(
    IDataProtectionProvider dataProtectionProvider,
    UserManager<GatewayUser> userManager) : IWorkerRegistrationKeyService
{
    private const string RegistrationKeyPrefix = "ctwk_";
    private readonly IDataProtector protector = dataProtectionProvider.CreateProtector("CortexTerminal.Gateway.WorkerRegistrationKey.v1");

    public async Task<WorkerRegistrationKeyIssueResult> IssueAsync(GatewayUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(user.SecurityStamp))
        {
            await userManager.UpdateSecurityStampAsync(user);
            user = await userManager.FindByIdAsync(user.Id.ToString())
                ?? throw new InvalidOperationException("Unable to reload user after updating the security stamp.");
        }

        var issuedAtUtc = DateTime.UtcNow;
        var protectedPayload = protector.Protect(JsonSerializer.Serialize(new WorkerRegistrationKeyPayload(
            user.Id,
            user.SecurityStamp!,
            issuedAtUtc)));

        return new WorkerRegistrationKeyIssueResult(
            RegistrationKeyPrefix + protectedPayload,
            issuedAtUtc,
            user);
    }

    public async Task<WorkerRegistrationKeyValidationResult?> ValidateAsync(string registrationKey, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedKey = registrationKey.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKey)
            || !normalizedKey.StartsWith(RegistrationKeyPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        WorkerRegistrationKeyPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<WorkerRegistrationKeyPayload>(
                protector.Unprotect(normalizedKey[RegistrationKeyPrefix.Length..]));
        }
        catch
        {
            return null;
        }

        if (payload is null)
        {
            return null;
        }

        var user = await userManager.FindByIdAsync(payload.UserId.ToString());
        if (user is null || string.IsNullOrWhiteSpace(user.SecurityStamp))
        {
            return null;
        }

        return string.Equals(user.SecurityStamp, payload.SecurityStamp, StringComparison.Ordinal)
            ? new WorkerRegistrationKeyValidationResult(user, payload.IssuedAtUtc)
            : null;
    }

    private sealed record WorkerRegistrationKeyPayload(
        Guid UserId,
        string SecurityStamp,
        DateTime IssuedAtUtc);
}