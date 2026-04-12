import { useMemo, useState } from "react";
import { Command, RadioTower, Search, ShieldCheck } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import type { GatewayAuditEntry } from "../../lib/gatewayManagementClient";

type AuditPageProps = {
  entries: GatewayAuditEntry[];
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
};

type AuditCategoryFilter = "all" | "session" | "worker" | "command";

function getAuditIcon(category: string) {
  switch (category) {
    case "command":
      return Command;
    case "worker":
      return RadioTower;
    default:
      return ShieldCheck;
  }
}

export function AuditPage({
  entries,
  isLoading,
  error,
  onBack,
}: AuditPageProps) {
  const [categoryFilter, setCategoryFilter] =
    useState<AuditCategoryFilter>("all");
  const [keyword, setKeyword] = useState("");

  const filteredEntries = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return entries.filter((entry) => {
      if (categoryFilter !== "all" && entry.category !== categoryFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [
        entry.summary,
        entry.kind,
        entry.category,
        entry.actorType,
        entry.actorId,
        entry.sessionId,
        entry.workerId,
        entry.traceId,
        entry.payloadJson,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword),
        );
    });
  }, [categoryFilter, entries, keyword]);

  return (
    <PageShell
      title="审计"
      subtitle="只看关键事件。"
      onBack={onBack}
      backLabel="back to settings"
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {(["all", "session", "worker", "command"] as const).map(
                (filter) => (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={
                      categoryFilter === filter ? "default" : "secondary"
                    }
                    onClick={() => setCategoryFilter(filter)}
                  >
                    {filter === "all"
                      ? "全部"
                      : filter === "session"
                        ? "会话"
                        : filter === "worker"
                          ? "节点"
                          : "命令"}
                  </Button>
                ),
              )}
            </div>

            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-500"
              />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索会话、节点或事件"
                className="pl-10"
              />
            </div>

            <div className="text-[11px] text-gray-500">
              {filteredEntries.length} / {entries.length} 条
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {isLoading && entries.length === 0 && (
          <Card>
            <CardContent className="px-4 py-8 text-center text-sm text-gray-500">
              正在加载审计记录…
            </CardContent>
          </Card>
        )}

        {!isLoading && filteredEntries.length === 0 && (
          <Card>
            <CardContent className="px-4 py-8 text-center text-sm text-gray-500">
              没有符合当前筛选条件的审计记录。
            </CardContent>
          </Card>
        )}

        {filteredEntries.map((entry) => {
          const Icon = getAuditIcon(entry.category);

          return (
            <Card key={entry.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[#181818] p-3 text-cyan-400">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-500">
                      <span>{entry.category}</span>
                      <span>·</span>
                      <span>{entry.kind}</span>
                      <span>·</span>
                      <span>
                        {new Date(entry.createdAtUtc).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {entry.summary}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500 break-all">
                      {entry.actorType && <span>actor: {entry.actorType}</span>}
                      {entry.sessionId && (
                        <span>session: {entry.sessionId}</span>
                      )}
                      {entry.workerId && <span>worker: {entry.workerId}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
