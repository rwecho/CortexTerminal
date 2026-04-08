using System.Text;
using CortexTerminal.Gateway.Services;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Relay;
using CortexTerminal.Gateway.Services.Sessions;
using CortexTerminal.Gateway.Services.Auth;
using CortexTerminal.Gateway.Services.Workers;
using Microsoft.AspNetCore.SignalR;
using OpenIddict.Abstractions;

namespace CortexTerminal.Gateway.Hubs;

public sealed class RelayHub(
    ISessionRegistry sessionRegistry,
    ISessionManagementService sessionManagementService,
    IWorkerManagementService workerManagementService,
    IAuditTrailService auditTrailService,
    ILogger<RelayHub> logger) : Hub
{
    private const string ReceiveFromMobileMethod = "ReceiveFromMobile";
    private const string ReceiveFromWorkerMethod = "ReceiveFromWorker";

    public async Task RegisterWorker(string workerId)
    {
        EnsureWorkerCaller(workerId);
        sessionRegistry.RegisterWorker(workerId, Context.ConnectionId);
        await workerManagementService.RegisterConnectionAsync(workerId, Context.ConnectionId, Context.ConnectionAborted);
        logger.LogInformation(
            "[register-worker] WorkerId={WorkerId}, ConnectionId={ConnectionId}",
            workerId,
            Context.ConnectionId);
    }

    public async Task RegisterMobileSession(string sessionId, string workerId)
    {
        EnsureGatewayUserCaller();
        sessionRegistry.BindSessionToWorker(sessionId, workerId);
        sessionRegistry.RegisterMobileSessionConnection(sessionId, Context.ConnectionId);
        await sessionManagementService.ActivateBindingAsync(
            sessionId,
            workerId,
            Context.ConnectionId,
            Context.ConnectionAborted);
        logger.LogInformation(
            "[register-mobile] SessionId={SessionId}, WorkerId={WorkerId}, ConnectionId={ConnectionId}",
            sessionId,
            workerId,
            Context.ConnectionId);

        logger.LogDebug(
            "[register-mobile-detail] SessionId={SessionId} bound to WorkerId={WorkerId} by ConnectionId={ConnectionId}",
            sessionId,
            workerId,
            Context.ConnectionId);
    }

    public async Task RelayFromMobile(string sessionId, string encryptedFrameBase64, string? requestId = null, string? traceId = null)
    {
        EnsureGatewayUserCaller();
        logger.LogInformation(
            "[relay-mobile->gateway:recv] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, ConnectionId={ConnectionId}, Base64Length={Base64Length}",
            sessionId,
            requestId,
            traceId,
            Context.ConnectionId,
            encryptedFrameBase64.Length);
        logger.LogDebug(
            "[relay-mobile->gateway:recv:payload] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadBase64={PayloadBase64}",
            sessionId,
            requestId,
            traceId,
            encryptedFrameBase64);

        if (!sessionRegistry.TryGetWorkerBySession(sessionId, out var workerId))
        {
            logger.LogError(
                "[relay-mobile->gateway:drop] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId} is not bound to any worker. CallerConnectionId={ConnectionId}",
                sessionId,
                requestId,
                traceId,
                Context.ConnectionId);
            throw new HubException($"Session {sessionId} is not bound to a worker.");
        }

        if (!sessionRegistry.TryGetWorkerConnection(workerId, out var workerConnectionId))
        {
            logger.LogError(
                "[relay-mobile->gateway:drop] WorkerId={WorkerId} for SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId} is not connected.",
                workerId,
                sessionId,
                requestId,
                traceId);
            throw new HubException($"Worker {workerId} is not connected.");
        }

        logger.LogInformation(
            "[relay-mobile->worker:send] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, WorkerId={WorkerId}, WorkerConnectionId={WorkerConnectionId}, Base64Length={Base64Length}",
            sessionId,
            requestId,
            traceId,
            workerId,
            workerConnectionId,
            encryptedFrameBase64.Length);

        await sessionManagementService.TouchAsync(sessionId, traceId, Context.ConnectionAborted);
        await WriteCommandAuditAsync(sessionId, workerId, encryptedFrameBase64, requestId, traceId);

        await Clients.Client(workerConnectionId).SendAsync(ReceiveFromMobileMethod, sessionId, encryptedFrameBase64, requestId, traceId);
    }

    public async Task RelayFromWorker(string sessionId, string encryptedFrameBase64, string? requestId = null, string? traceId = null)
    {
        var callerWorkerId = EnsureWorkerCaller();
        logger.LogInformation(
            "[relay-worker->gateway:recv] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, ConnectionId={ConnectionId}, Base64Length={Base64Length}",
            sessionId,
            requestId,
            traceId,
            Context.ConnectionId,
            encryptedFrameBase64.Length);
        logger.LogDebug(
            "[relay-worker->gateway:recv:payload] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadBase64={PayloadBase64}",
            sessionId,
            requestId,
            traceId,
            encryptedFrameBase64);

        if (!sessionRegistry.TryGetWorkerBySession(sessionId, out var expectedWorkerId)
            || !string.Equals(expectedWorkerId, callerWorkerId, StringComparison.Ordinal))
        {
            logger.LogWarning(
                "[relay-worker->gateway:reject] SessionId={SessionId}, CallerWorkerId={CallerWorkerId}, ExpectedWorkerId={ExpectedWorkerId}",
                sessionId,
                callerWorkerId,
                expectedWorkerId);
            throw new HubException($"Worker {callerWorkerId} is not authorized for session {sessionId}.");
        }

        if (!sessionRegistry.TryGetMobileConnectionBySession(sessionId, out var mobileConnectionId))
        {
            logger.LogError(
                "[relay-worker->gateway:drop] No mobile connection for SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}. WorkerConnectionId={ConnectionId}",
                sessionId,
                requestId,
                traceId,
                Context.ConnectionId);
            throw new HubException($"Mobile connection for session {sessionId} is not connected.");
        }

        logger.LogInformation(
            "[relay-gateway->mobile:send] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, MobileConnectionId={MobileConnectionId}, Base64Length={Base64Length}",
            sessionId,
            requestId,
            traceId,
            mobileConnectionId,
            encryptedFrameBase64.Length);

        await sessionManagementService.TouchAsync(sessionId, traceId, Context.ConnectionAborted);

        await Clients.Client(mobileConnectionId).SendAsync(ReceiveFromWorkerMethod, sessionId, encryptedFrameBase64, requestId, traceId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        sessionRegistry.RemoveConnection(Context.ConnectionId);
        await sessionManagementService.MarkDisconnectedByConnectionAsync(Context.ConnectionId, Context.ConnectionAborted);
        await workerManagementService.MarkDisconnectedByConnectionAsync(Context.ConnectionId, Context.ConnectionAborted);
        logger.LogInformation("[disconnect] ConnectionId={ConnectionId}, Exception={Exception}", Context.ConnectionId, exception?.Message);
        await base.OnDisconnectedAsync(exception);
    }

    private string EnsureWorkerCaller(string? expectedWorkerId = null)
    {
        var workerId = Context.User?.FindFirst(GatewayClaimTypes.WorkerId)?.Value;
        if (string.IsNullOrWhiteSpace(workerId)
            || !Context.User!.GetScopes().Contains("worker.manage"))
        {
            throw new HubException("Authenticated worker token is required.");
        }

        if (!string.IsNullOrWhiteSpace(expectedWorkerId)
            && !string.Equals(workerId, expectedWorkerId, StringComparison.Ordinal))
        {
            throw new HubException($"Worker token does not match requested worker '{expectedWorkerId}'.");
        }

        return workerId;
    }

    private void EnsureGatewayUserCaller()
    {
        var principal = Context.User;
        if (principal is null)
        {
            throw new HubException("Authenticated user token is required.");
        }

        if (principal.HasClaim(claim => claim.Type == GatewayClaimTypes.WorkerId)
            || !principal.HasClaim(claim => claim.Type == OpenIddictConstants.Claims.Subject))
        {
            throw new HubException("Authenticated gateway user token is required.");
        }
    }

    private async Task WriteCommandAuditAsync(string sessionId, string workerId, string encryptedFrameBase64, string? requestId, string? traceId)
    {
        if (!RelayControlFrameAuditExtractor.TryExtractAuditedCommand(encryptedFrameBase64, out var auditedCommand)
            || auditedCommand is null)
        {
            return;
        }

        var actorId = Context.User?.FindFirst(OpenIddictConstants.Claims.Subject)?.Value;

        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "command",
                "submitted",
                auditedCommand.AttachmentFileNames.Count == 0
                    ? $"会话 {sessionId} 提交命令：{auditedCommand.CommandText}"
                    : $"会话 {sessionId} 提交带附件命令：{auditedCommand.CommandText}",
                ActorType: "user",
                ActorId: actorId,
                SessionId: sessionId,
                WorkerId: workerId,
                TraceId: traceId,
                Payload: new
                {
                    requestId,
                    command = auditedCommand.CommandText,
                    attachments = auditedCommand.AttachmentFileNames
                }),
            Context.ConnectionAborted);
    }
}
