using System.Security.Claims;
using CortexTerminal.Gateway.Contracts.Auth;
using CortexTerminal.Gateway.Contracts.Users;
using CortexTerminal.Gateway.Models.Auth;
using CortexTerminal.Gateway.Models.Users;
using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayAuthEndpointRouteBuilderExtensions
{
    private static readonly HashSet<string> UserAllowedScopes = new(StringComparer.Ordinal)
    {
        "gateway.api",
        "relay.connect",
        Scopes.OfflineAccess
    };

    private static readonly HashSet<string> WorkerAllowedScopes = new(StringComparer.Ordinal)
    {
        "relay.connect",
        "worker.manage",
        Scopes.OfflineAccess
    };

    public static IEndpointRouteBuilder MapGatewayAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/api/auth").WithTags("Gateway Auth");

        auth.MapPost("/register", async (RegisterGatewayUserRequest request, UserManager<GatewayUser> userManager) =>
        {
            var username = request.Username.Trim();
            if (string.IsNullOrWhiteSpace(username))
            {
                return Results.BadRequest(new { message = "Username is required." });
            }

            var utcNow = DateTime.UtcNow;
            var user = new GatewayUser
            {
                Id = Guid.NewGuid(),
                UserName = username,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim(),
                Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
                CreatedAtUtc = utcNow,
                UpdatedAtUtc = utcNow
            };

            var createResult = await userManager.CreateAsync(user, request.Password);
            if (!createResult.Succeeded)
            {
                return Results.BadRequest(new
                {
                    message = "User registration failed.",
                    errors = createResult.Errors.Select(error => error.Description).ToArray()
                });
            }

            return Results.Created($"/api/users/{user.Id}", GatewayUserResponse.FromModel(user));
        });

        auth.MapGet("/me", (ClaimsPrincipal principal) =>
        {
            return Results.Ok(new GatewayPrincipalResponse(
                principal.GetClaim(Claims.Subject) ?? string.Empty,
                principal.GetClaim(Claims.PreferredUsername),
                principal.GetClaim(Claims.Name),
                principal.GetClaim(Claims.Email),
                principal.GetScopes().ToArray(),
                principal.GetClaim(Claims.ClientId)));
        }).RequireAuthorization();

        endpoints.MapPost("/connect/token", async Task<IResult> (HttpContext httpContext, UserManager<GatewayUser> userManager, IWorkerDeviceAuthorizationService workerDeviceAuthorizationService) =>
        {
            var request = httpContext.GetOpenIddictServerRequest();
            if (request is null)
            {
                return Results.BadRequest(new { error = Errors.InvalidRequest, error_description = "OpenIddict request payload is missing." });
            }

            if (request.IsPasswordGrantType())
            {
                var username = request.Username?.Trim();
                if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return Results.BadRequest(new { error = Errors.InvalidRequest, error_description = "Username and password are required." });
                }

                var user = await userManager.FindByNameAsync(username);
                if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
                {
                    return CreateForbidResult(Errors.InvalidGrant, "The username/password combination is invalid.");
                }

                user.UpdatedAtUtc = DateTime.UtcNow;
                await userManager.UpdateAsync(user);

                var principal = CreateUserPrincipal(user, request.GetScopes());
                return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            if (request.IsClientCredentialsGrantType())
            {
                if (string.IsNullOrWhiteSpace(request.ClientId))
                {
                    return Results.BadRequest(new { error = Errors.InvalidClient, error_description = "Client credentials are required." });
                }

                var principal = CreateWorkerPrincipal(request.ClientId, request.GetScopes());
                return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            if (string.Equals(request.GrantType, "urn:cortex:grant-type:worker_device_code", StringComparison.Ordinal))
            {
                var deviceCode = request.GetParameter("device_code")?.ToString();
                if (string.IsNullOrWhiteSpace(deviceCode))
                {
                    return Results.BadRequest(new { error = Errors.InvalidRequest, error_description = "device_code is required." });
                }

                var authorization = await workerDeviceAuthorizationService.RedeemApprovedChallengeAsync(deviceCode, httpContext.RequestAborted);
                if (authorization is null)
                {
                    return CreateForbidResult("invalid_device_code", "The provided device code is invalid.");
                }

                if (authorization.Status == WorkerDeviceAuthorizationStatus.Pending)
                {
                    return CreateForbidResult("authorization_pending", "The worker device pairing request is still pending approval.");
                }

                if (authorization.Status == WorkerDeviceAuthorizationStatus.Expired)
                {
                    return CreateForbidResult("expired_token", "The worker device pairing request has expired.");
                }

                if (authorization.Status != WorkerDeviceAuthorizationStatus.Redeemed)
                {
                    return CreateForbidResult(Errors.InvalidGrant, "The worker device pairing request could not be redeemed.");
                }

                var principal = CreateWorkerPrincipal(
                    authorization.WorkerId,
                    authorization.RequestedScopes.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    authorization.WorkerDisplayName);

                return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            if (request.IsRefreshTokenGrantType())
            {
                var authenticateResult = await httpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
                if (!authenticateResult.Succeeded || authenticateResult.Principal is null)
                {
                    return CreateForbidResult(Errors.InvalidGrant, "The refresh token is no longer valid.");
                }

                var principal = authenticateResult.Principal;
                SetClaimDestinations(principal);
                return Results.SignIn(principal, authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            }

            return Results.BadRequest(new { error = Errors.UnsupportedGrantType, error_description = "The specified grant type is not supported." });
        });

        return endpoints;
    }

    private static ClaimsPrincipal CreateUserPrincipal(GatewayUser user, IEnumerable<string> requestedScopes)
    {
        var identity = new ClaimsIdentity("Token", Claims.Name, Claims.Role);
        identity.SetClaim(Claims.Subject, user.Id.ToString());
        identity.SetClaim(Claims.PreferredUsername, user.UserName ?? string.Empty);
        identity.SetClaim(Claims.Name, user.DisplayName);

        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            identity.SetClaim(Claims.Email, user.Email);
        }

        var principal = new ClaimsPrincipal(identity);
        principal.SetScopes(FilterScopes(requestedScopes, UserAllowedScopes, "gateway.api"));
        principal.SetResources("gateway");
        SetClaimDestinations(principal);
        return principal;
    }

    private static ClaimsPrincipal CreateWorkerPrincipal(string workerId, IEnumerable<string> requestedScopes, string? displayName = null)
    {
        var identity = new ClaimsIdentity("Token", Claims.Name, Claims.Role);
        identity.SetClaim(Claims.Subject, workerId);
        identity.SetClaim(GatewayClaimTypes.WorkerId, workerId);
        identity.SetClaim(Claims.ClientId, workerId);
        identity.SetClaim(Claims.Name, string.IsNullOrWhiteSpace(displayName) ? $"Cortex Worker {workerId}" : displayName);

        var principal = new ClaimsPrincipal(identity);
        principal.SetScopes(FilterScopes(requestedScopes, WorkerAllowedScopes, "worker.manage"));
        principal.SetResources("gateway");
        SetClaimDestinations(principal);
        return principal;
    }

    private static IReadOnlyList<string> FilterScopes(IEnumerable<string> requestedScopes, HashSet<string> allowedScopes, string defaultScope)
    {
        var scopes = requestedScopes
            .Where(scope => allowedScopes.Contains(scope))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return scopes.Length > 0 ? scopes : new[] { defaultScope };
    }

    private static void SetClaimDestinations(ClaimsPrincipal principal)
    {
        foreach (var claim in principal.Claims)
        {
            claim.SetDestinations(Destinations.AccessToken);
        }
    }

    private static IResult CreateForbidResult(string error, string description)
    {
        var properties = new AuthenticationProperties();
        properties.Items[OpenIddictServerAspNetCoreConstants.Properties.Error] = error;
        properties.Items[OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description;

        return Results.Forbid(properties, authenticationSchemes: new[] { OpenIddictServerAspNetCoreDefaults.AuthenticationScheme });
    }
}