using System.Security.Claims;
using CortexTerminal.Gateway.Contracts.Auth;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayWorkerDeviceAuthEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapGatewayWorkerDeviceAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var workerDevice = endpoints.MapGroup("/api/auth/worker/device")
            .WithTags("Gateway Worker Device Auth");

        workerDevice.MapPost("/", async (
            CreateWorkerDeviceAuthorizationRequest request,
            IWorkerDeviceAuthorizationService workerDeviceAuthorizationService,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var scopeText = string.IsNullOrWhiteSpace(request.Scope)
                    ? "relay.connect worker.manage offline_access"
                    : request.Scope;
                var scopes = scopeText
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                var authorization = await workerDeviceAuthorizationService.CreateChallengeAsync(
                    request.WorkerId,
                    request.DisplayName,
                    scopes,
                    cancellationToken);

                return Results.Ok(new WorkerDeviceAuthorizationChallengeResponse(
                    authorization.DeviceCode,
                    authorization.UserCode,
                    "/app/worker-pair",
                    (int)Math.Max(0, (authorization.ExpiresAtUtc - DateTime.UtcNow).TotalSeconds),
                    authorization.PollingIntervalSeconds,
                    authorization.WorkerId,
                    authorization.WorkerDisplayName));
            }
            catch (InvalidOperationException exception)
            {
                return Results.BadRequest(new { message = exception.Message });
            }
        });

        workerDevice.MapPost("/activate", async (
            ActivateWorkerDeviceAuthorizationRequest request,
            ClaimsPrincipal principal,
            UserManager<GatewayUser> userManager,
            IWorkerDeviceAuthorizationService workerDeviceAuthorizationService,
            CancellationToken cancellationToken) =>
        {
            var subject = principal.GetClaim(Claims.Subject);
            if (!Guid.TryParse(subject, out var userId))
            {
                return Results.Unauthorized();
            }

            var approver = await userManager.FindByIdAsync(userId.ToString());
            if (approver is null)
            {
                return Results.Unauthorized();
            }

            var authorization = await workerDeviceAuthorizationService.ApproveAsync(request.UserCode, approver, cancellationToken);
            if (authorization is null)
            {
                return Results.NotFound(new { message = "Worker pairing code is invalid, expired, or already used." });
            }

            return Results.Ok(new WorkerDeviceAuthorizationActivationResponse(
                authorization.WorkerId,
                authorization.WorkerDisplayName,
                authorization.UserCode,
                authorization.ApprovedByDisplayName ?? approver.DisplayName,
                authorization.ApprovedAtUtc ?? DateTime.UtcNow));
        }).RequireAuthorization("GatewayUser");

        return endpoints;
    }
}
