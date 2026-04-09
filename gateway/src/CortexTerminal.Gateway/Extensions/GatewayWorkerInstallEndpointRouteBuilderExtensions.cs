using System.Security.Claims;
using System.Text;
using CortexTerminal.Gateway.Contracts.Auth;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayWorkerInstallEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapGatewayWorkerInstallEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/install-worker.sh", (HttpContext httpContext) =>
        {
            var token = httpContext.Request.Query["token"].ToString().Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest("token is required.");
            }

            var gatewayBaseUrl = BuildGatewayBaseUrl(httpContext.Request);
            var script = WorkerInstallScriptBuilder.BuildUnixScript(gatewayBaseUrl, token);
            return Results.Text(script, "application/x-sh", Encoding.UTF8);
        });

        endpoints.MapGet("/install-worker.ps1", (HttpContext httpContext) =>
        {
            var token = httpContext.Request.Query["token"].ToString().Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return Results.BadRequest("token is required.");
            }

            var gatewayBaseUrl = BuildGatewayBaseUrl(httpContext.Request);
            var script = WorkerInstallScriptBuilder.BuildWindowsScript(gatewayBaseUrl, token);
            return Results.Text(script, "text/plain", Encoding.UTF8);
        });

        endpoints.MapPost("/api/worker/install/registration-key", async (
            WorkerInstallBootstrapRequest request,
            IWorkerInstallTokenService workerInstallTokenService,
            IWorkerRegistrationKeyService workerRegistrationKeyService,
            CancellationToken cancellationToken) =>
        {
            var consumedToken = await workerInstallTokenService.ConsumeAsync(request.Token, cancellationToken);
            if (consumedToken is null)
            {
                return Results.BadRequest(new { message = "Install token is invalid, expired, or already used." });
            }

            var registrationKey = await workerRegistrationKeyService.IssueAsync(consumedToken.User, cancellationToken);
            return Results.Text(registrationKey.RegistrationKey, "text/plain", Encoding.UTF8);
        });

        var auth = endpoints.MapGroup("/api/auth/worker").WithTags("Gateway Worker Install");
        auth.MapPost("/install-token", async (
            HttpContext httpContext,
            ClaimsPrincipal principal,
            UserManager<GatewayUser> userManager,
            IWorkerInstallTokenService workerInstallTokenService,
            CancellationToken cancellationToken) =>
        {
            var subject = principal.GetClaim(Claims.Subject);
            if (!Guid.TryParse(subject, out var userId))
            {
                return Results.Unauthorized();
            }

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null)
            {
                return Results.Unauthorized();
            }

            var result = await workerInstallTokenService.IssueAsync(user, cancellationToken);
            var gatewayBaseUrl = BuildGatewayBaseUrl(httpContext.Request);
            var installCommands = WorkerInstallScriptBuilder.BuildCommandSet(gatewayBaseUrl, result.Token);
            return Results.Ok(new WorkerInstallTokenResponse(
                result.Token,
                result.IssuedAtUtc,
                result.ExpiresAtUtc,
                installCommands.UnixUrl,
                installCommands.UnixCommand,
                installCommands));
        }).RequireAuthorization("GatewayUser");

        return endpoints;
    }

    private static string BuildGatewayBaseUrl(HttpRequest request)
    {
        var scheme = GetForwardedHeaderValue(request.Headers["X-Forwarded-Proto"])
            ?? request.Scheme;

        var forwardedHost = GetForwardedHeaderValue(request.Headers["X-Forwarded-Host"]);
        var host = string.IsNullOrWhiteSpace(forwardedHost)
            ? request.Host.Value
            : forwardedHost;

        return $"{scheme}://{host}{request.PathBase}".TrimEnd('/');
    }

    internal static string? GetForwardedHeaderValue(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        return rawValue
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
    }

    private sealed record WorkerInstallBootstrapRequest(string Token);
}
