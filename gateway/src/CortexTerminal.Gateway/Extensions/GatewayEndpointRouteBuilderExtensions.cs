using System.Security.Claims;
using CortexTerminal.Gateway.Contracts.Sessions;
using CortexTerminal.Gateway.Contracts.Users;
using CortexTerminal.Gateway.Contracts.Workers;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Auth;
using CortexTerminal.Gateway.Services.Sessions;
using CortexTerminal.Gateway.Services.Users;
using CortexTerminal.Gateway.Services.Workers;

namespace CortexTerminal.Gateway.Extensions;

public static class GatewayEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapGatewayManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var users = endpoints.MapGroup("/api/users").WithTags("Gateway Users").RequireAuthorization("GatewayUser");
        users.MapGet("/", async (IUserManagementService userManagementService, CancellationToken cancellationToken) =>
            Results.Ok(await userManagementService.ListAsync(cancellationToken)));
        users.MapGet("/{userId:guid}", async (Guid userId, IUserManagementService userManagementService, CancellationToken cancellationToken) =>
        {
            var user = await userManagementService.GetAsync(userId, cancellationToken);
            return user is null ? Results.NotFound() : Results.Ok(user);
        });
        users.MapPost("/", async (CreateGatewayUserRequest request, IUserManagementService userManagementService, CancellationToken cancellationToken) =>
        {
            try
            {
                var user = await userManagementService.CreateAsync(request, cancellationToken);
                return Results.Created($"/api/users/{user.Id}", user);
            }
            catch (InvalidOperationException exception)
            {
                return Results.Conflict(new { message = exception.Message });
            }
        });

        var workers = endpoints.MapGroup("/api/workers").WithTags("Gateway Workers");
        workers.MapGet("/", async (IWorkerManagementService workerManagementService, CancellationToken cancellationToken) =>
            Results.Ok(await workerManagementService.ListAsync(cancellationToken))).RequireAuthorization("GatewayUser");
        workers.MapGet("/{workerId}", async (string workerId, IWorkerManagementService workerManagementService, CancellationToken cancellationToken) =>
        {
            var worker = await workerManagementService.GetAsync(workerId, cancellationToken);
            return worker is null ? Results.NotFound() : Results.Ok(worker);
        }).RequireAuthorization("GatewayUser");
        workers.MapDelete("/{workerId}", async (string workerId, IWorkerManagementService workerManagementService, CancellationToken cancellationToken) =>
        {
            try
            {
                var deleted = await workerManagementService.DeleteOfflineAsync(workerId, cancellationToken);
                return deleted ? Results.NoContent() : Results.NotFound();
            }
            catch (InvalidOperationException exception)
            {
                return Results.Conflict(new { message = exception.Message });
            }
        }).RequireAuthorization("GatewayUser");
        workers.MapPost("/", async (UpsertWorkerRequest request, ClaimsPrincipal principal, IWorkerManagementService workerManagementService, CancellationToken cancellationToken) =>
        {
            if (!WorkerMatchesRequest(principal, request.WorkerId))
            {
                return Results.Forbid();
            }

            try
            {
                var worker = await workerManagementService.UpsertAsync(request, cancellationToken);
                return Results.Ok(worker);
            }
            catch (InvalidOperationException exception)
            {
                return Results.BadRequest(new { message = exception.Message });
            }
        }).RequireAuthorization("WorkerNode");
        workers.MapPost("/{workerId}/heartbeat", async (string workerId, ClaimsPrincipal principal, IWorkerManagementService workerManagementService, CancellationToken cancellationToken) =>
        {
            if (!WorkerMatchesRequest(principal, workerId))
            {
                return Results.Forbid();
            }

            await workerManagementService.RecordHeartbeatAsync(workerId, cancellationToken);
            var worker = await workerManagementService.GetAsync(workerId, cancellationToken);
            return worker is null ? Results.NotFound() : Results.Ok(worker);
        }).RequireAuthorization("WorkerNode");

        var sessions = endpoints.MapGroup("/api/sessions").WithTags("Gateway Sessions").RequireAuthorization("GatewayUser");
        sessions.MapGet("/", async (ISessionManagementService sessionManagementService, CancellationToken cancellationToken) =>
            Results.Ok(await sessionManagementService.ListAsync(cancellationToken)));
        endpoints.MapGet("/api/audit", async (int? take, IAuditTrailService auditTrailService, CancellationToken cancellationToken) =>
            Results.Ok(await auditTrailService.ListAsync(take ?? 100, cancellationToken)))
            .WithTags("Gateway Audit")
            .RequireAuthorization("GatewayUser");
        endpoints.MapGet("/api/sessions/{sessionId}", async (string sessionId, ClaimsPrincipal principal, ISessionManagementService sessionManagementService, CancellationToken cancellationToken) =>
        {
            var session = await sessionManagementService.GetAsync(sessionId, cancellationToken);
            if (session is null)
            {
                return Results.NotFound();
            }

            var workerId = principal.FindFirst(GatewayClaimTypes.WorkerId)?.Value;
            if (!string.IsNullOrWhiteSpace(workerId)
                && !string.Equals(session.WorkerId, workerId, StringComparison.Ordinal))
            {
                return Results.Forbid();
            }

            return Results.Ok(session);
        }).WithTags("Gateway Sessions").RequireAuthorization("GatewayUserOrWorkerNode");
        sessions.MapPost("/", async (CreateGatewaySessionRequest request, ISessionManagementService sessionManagementService, CancellationToken cancellationToken) =>
        {
            try
            {
                var session = await sessionManagementService.CreateAsync(request, cancellationToken);
                return Results.Created($"/api/sessions/{session.SessionId}", session);
            }
            catch (InvalidOperationException exception)
            {
                return Results.BadRequest(new { message = exception.Message });
            }
        });
        sessions.MapPost("/{sessionId}/bind", async (string sessionId, BindGatewaySessionRequest request, ISessionManagementService sessionManagementService, CancellationToken cancellationToken) =>
        {
            var session = await sessionManagementService.BindSessionAsync(sessionId, request, cancellationToken);
            return session is null ? Results.NotFound() : Results.Ok(session);
        });
        sessions.MapPost("/{sessionId}/close", async (string sessionId, ISessionManagementService sessionManagementService, CancellationToken cancellationToken) =>
        {
            var session = await sessionManagementService.CloseAsync(sessionId, cancellationToken);
            return session is null ? Results.NotFound() : Results.Ok(session);
        });

        return endpoints;
    }

    private static bool WorkerMatchesRequest(ClaimsPrincipal? principal, string workerId)
    {
        var claimWorkerId = principal?.FindFirst(GatewayClaimTypes.WorkerId)?.Value;
        return !string.IsNullOrWhiteSpace(claimWorkerId)
               && string.Equals(claimWorkerId, workerId, StringComparison.Ordinal);
    }
}
