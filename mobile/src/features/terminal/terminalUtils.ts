import type {
  GatewaySession,
  GatewayWorker,
} from "../../lib/gatewayManagementClient";

export function buildSessionAccessError(
  session: GatewaySession,
  worker: GatewayWorker | null,
) {
  if (!session.workerId) {
    return "当前会话还没有绑定 worker，无法打开终端。\nThis session is not bound to a worker yet.";
  }

  if (!worker) {
    return `会话绑定的 worker ${session.workerId} 不存在或已被清理。\nWorker ${session.workerId} no longer exists.`;
  }

  const heartbeatText = worker.lastHeartbeatAtUtc
    ? `最后心跳 ${new Date(worker.lastHeartbeatAtUtc).toLocaleString()}`
    : "尚未收到有效心跳";

  return `节点 ${worker.displayName} 当前离线，无法打开该会话。请先恢复 worker 连接，或将会话重新绑定到在线节点。\n${heartbeatText}`;
}
