using System.Text;
using CortexTerminal.Worker.Services.Sessions;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Services;

public sealed class WorkerMobileFrameDispatcher(
    WorkerSessionCoordinator sessionCoordinator,
    RingBuffer ringBuffer,
    ILogger logger,
    string workerId,
    string workerModelName)
{
    public async Task HandleAsync(
        string sessionId,
        string encryptedFrameBase64,
        string? requestId,
        string? traceId,
        CancellationToken cancellationToken)
    {
        var inbound = Encoding.UTF8.GetString(Convert.FromBase64String(encryptedFrameBase64));
        var hasAttachmentCommand = RelayAttachmentCommandProcessor.TryParseAttachmentCommand(inbound, out var attachmentCommand);
        var hasDoctorCommand = RelayAttachmentCommandProcessor.TryParseDoctorCommand(inbound, out _);
        ringBuffer.Append(
            hasDoctorCommand
                ? $"[{DateTimeOffset.UtcNow:O}] mobile:{sessionId} => <doctor-command>"
                : hasAttachmentCommand && attachmentCommand is not null
                ? $"[{DateTimeOffset.UtcNow:O}] mobile:{sessionId} => <attachment-command attachments={attachmentCommand.Attachments.Count}>"
                : $"[{DateTimeOffset.UtcNow:O}] mobile:{sessionId} => {inbound}");

        logger.LogInformation(
            "[relay-gateway->worker:recv] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, Base64Length={Base64Length}, PlaintextLength={PlaintextLength}",
            sessionId,
            requestId,
            traceId,
            encryptedFrameBase64.Length,
            inbound.Length);
        logger.LogDebug(
            "[relay-gateway->worker:recv:payload] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadBase64={PayloadBase64}",
            sessionId,
            requestId,
            traceId,
            encryptedFrameBase64);
        logger.LogDebug(
            "[relay-gateway->worker:recv:text] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadText={PayloadText}",
            sessionId,
            requestId,
            traceId,
            inbound);

        var session = await sessionCoordinator.GetOrCreateSessionAsync(sessionId, requestId, traceId, cancellationToken);
        if (session is null)
        {
            await sessionCoordinator.RelayTextFrameAsync(
                sessionId,
                $"__ct_error__:{workerModelName} session startup failed. 请检查所选 runtime CLI 的安装/登录状态。\r\n",
                requestId,
                traceId,
                cancellationToken);
            return;
        }

        sessionCoordinator.MarkInboundActivity(session, traceId);

        if (string.Equals(inbound.Trim(), "__ct_init__", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.Equals(inbound.Trim(), "/__ct_pwd", StringComparison.OrdinalIgnoreCase))
        {
            await sessionCoordinator.RelayTextFrameAsync(
                sessionId,
                $"__ct_cwd__:{session.WorkingDirectory}\n[worker] {workerModelName} session is ready.\r\n",
                requestId,
                traceId,
                cancellationToken);
            return;
        }

        if (hasDoctorCommand)
        {
            await HandleDoctorCommandAsync(session, sessionId, requestId, traceId, cancellationToken);
            return;
        }

        if (hasAttachmentCommand && attachmentCommand is not null)
        {
            await HandleAttachmentCommandAsync(session, sessionId, attachmentCommand, requestId, traceId, cancellationToken);
            return;
        }

        var forwardedInput = WorkerInputNormalizer.NormalizeAgentInput(inbound);
        logger.LogInformation("[agent:stdin] SessionId={SessionId}, Length={Length}, Runtime={Runtime}", sessionId, forwardedInput.Length, session.RuntimeCommand);
        await sessionCoordinator.SendInputAsync(session, forwardedInput, cancellationToken);
    }

    private async Task HandleDoctorCommandAsync(
        WorkerAgentSession session,
        string sessionId,
        string? requestId,
        string? traceId,
        CancellationToken cancellationToken)
    {
        try
        {
            logger.LogInformation("[worker:doctor:start] SessionId={SessionId}, Runtime={Runtime}", sessionId, session.RuntimeCommand);
            var report = await WorkerEnvironmentDoctor.RunAsync(
                workerId,
                workerModelName,
                session.RuntimeCommand,
                session.WorkingDirectory,
                cancellationToken);

            await sessionCoordinator.RelayTextFrameAsync(sessionId, report, requestId, traceId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[worker:doctor:failed] SessionId={SessionId}", sessionId);
            await sessionCoordinator.RelayTextFrameAsync(
                sessionId,
                $"__ct_error__:doctor 执行失败：{ex.Message}\r\n",
                requestId,
                traceId,
                cancellationToken);
        }
    }

    private async Task HandleAttachmentCommandAsync(
        WorkerAgentSession session,
        string sessionId,
        RelayAttachmentCommandFrame attachmentCommand,
        string? requestId,
        string? traceId,
        CancellationToken cancellationToken)
    {
        try
        {
            var stagedAttachments = await RelayAttachmentCommandProcessor.StageAttachmentsAsync(
                attachmentCommand,
                session.WorkingDirectory,
                sessionId,
                cancellationToken);
            var confirmationMessage = RelayAttachmentCommandProcessor.BuildWorkerConfirmationMessage(stagedAttachments);

            await sessionCoordinator.RelayTextFrameAsync(
                sessionId,
                confirmationMessage,
                requestId,
                traceId,
                cancellationToken);

            var augmentedCommand = RelayAttachmentCommandProcessor.BuildAgentCommand(
                attachmentCommand,
                stagedAttachments);

            logger.LogInformation(
                "[agent:attachment-command] SessionId={SessionId}, AttachmentCount={AttachmentCount}, CommandLength={CommandLength}",
                sessionId,
                stagedAttachments.Count,
                augmentedCommand.Length);

            await sessionCoordinator.SendInputAsync(session, augmentedCommand, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[worker:attachment-command-failed] SessionId={SessionId}", sessionId);
            await sessionCoordinator.RelayTextFrameAsync(
                sessionId,
                $"__ct_error__:附件同步失败：{ex.Message}\r\n",
                requestId,
                traceId,
                cancellationToken);
        }
    }
}