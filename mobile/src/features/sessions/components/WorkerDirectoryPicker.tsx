import {
  ChevronRight,
  FolderTree,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  GatewayWorker,
  WorkerDirectoryEntry,
} from "../../../lib/gatewayManagementClient";
import { Button } from "../../../components/ui/button";
import {
  getPathLabel,
  toUserFacingManagementError,
} from "../../app/appUtils";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";

type WorkerDirectoryPickerProps = {
  worker: GatewayWorker | null;
  selectedPath: string;
  onPathChange: (value: string) => void;
};

export function WorkerDirectoryPicker({
  worker,
  selectedPath,
  onPathChange,
}: WorkerDirectoryPickerProps) {
  const managementClient = useManagementClient();
  const handleAuthFailure = useAuthFailureHandler();
  const [isOpen, setIsOpen] = useState(false);
  const [rootEntries, setRootEntries] = useState<WorkerDirectoryEntry[]>([]);
  const [childEntriesByPath, setChildEntriesByPath] = useState<
    Record<string, WorkerDirectoryEntry[]>
  >({});
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [loadingRootEntries, setLoadingRootEntries] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedWorkerId = worker?.workerId ?? null;
  const displayLoadError = loadError
    ? toUserFacingManagementError(loadError)
    : null;
  const canBrowse = !!selectedWorkerId;

  useEffect(() => {
    setIsOpen(false);
    setRootEntries([]);
    setChildEntriesByPath({});
    setExpandedPaths([]);
    setLoadingRootEntries(false);
    setLoadingPath(null);
    setLoadError(null);
  }, [selectedWorkerId]);

  const loadEntries = useCallback(
    async (path?: string) => {
      if (!selectedWorkerId) {
        return [];
      }

      return (
        await managementClient.browseWorkerDirectories(selectedWorkerId, path)
      ).entries;
    },
    [managementClient, selectedWorkerId],
  );

  const loadRootDirectories = useCallback(async () => {
    if (!selectedWorkerId) {
      return;
    }

    try {
      setLoadingRootEntries(true);
      setLoadError(null);
      setRootEntries(await loadEntries());
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setLoadError(message);
      }
    } finally {
      setLoadingRootEntries(false);
    }
  }, [handleAuthFailure, loadEntries, selectedWorkerId]);

  const openPicker = useCallback(async () => {
    if (!selectedWorkerId) {
      return;
    }

    setIsOpen(true);
    if (rootEntries.length === 0) {
      await loadRootDirectories();
    }
  }, [loadRootDirectories, rootEntries.length, selectedWorkerId]);

  const toggleExpand = useCallback(
    async (entry: WorkerDirectoryEntry) => {
      if (!entry.hasChildren) {
        return;
      }

      if (expandedPaths.includes(entry.path)) {
        setExpandedPaths((current) =>
          current.filter((path) => path !== entry.path),
        );
        return;
      }

      setExpandedPaths((current) => [...current, entry.path]);

      if (childEntriesByPath[entry.path]) {
        return;
      }

      try {
        setLoadingPath(entry.path);
        setLoadError(null);
        const entries = await loadEntries(entry.path);
        setChildEntriesByPath((current) => ({
          ...current,
          [entry.path]: entries,
        }));
      } catch (error) {
        const message = (error as Error).message;
        if (!handleAuthFailure(message)) {
          setLoadError(message);
          setExpandedPaths((current) =>
            current.filter((path) => path !== entry.path),
          );
        }
      } finally {
        setLoadingPath((current) => (current === entry.path ? null : current));
      }
    },
    [
      childEntriesByPath,
      expandedPaths,
      handleAuthFailure,
      loadEntries,
      setChildEntriesByPath,
    ],
  );

  const treeContent = useMemo(() => {
    const renderEntries = (
      entries: WorkerDirectoryEntry[],
      depth: number,
    ): ReactNode[] =>
      entries.flatMap((entry) => {
        const isExpanded = expandedPaths.includes(entry.path);
        const childEntries = childEntriesByPath[entry.path] ?? [];
        const isLoadingChildren = loadingPath === entry.path;

        return [
          <div
            key={entry.path}
            className="space-y-2"
            style={{ paddingLeft: `${depth * 14}px` }}
          >
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  void toggleExpand(entry);
                }}
                className="mt-0.5 h-8 w-8 shrink-0 text-gray-400"
                aria-label={`${isExpanded ? "收起" : "展开"} ${entry.path}`}
                disabled={!entry.hasChildren}
              >
                {isLoadingChildren ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <ChevronRight
                    size={14}
                    className={isExpanded ? "rotate-90" : undefined}
                  />
                )}
              </Button>
              <button
                type="button"
                className={`flex-1 rounded-2xl border px-3 py-2 text-left transition-colors ${
                  selectedPath === entry.path
                    ? "border-cyan-700/50 bg-cyan-950/20 text-cyan-100"
                    : "border-[#1f2a30] bg-[#0a0f12] text-gray-100 hover:bg-[#11191d]"
                }`}
                onClick={() => {
                  onPathChange(entry.path);
                  setIsOpen(false);
                }}
                aria-label={`选择目录 ${entry.path}`}
              >
                <div className="text-sm font-semibold">
                  {entry.name || getPathLabel(entry.path)}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-gray-400">
                  {entry.path}
                </div>
              </button>
            </div>
          </div>,
          ...(isExpanded ? renderEntries(childEntries, depth + 1) : []),
        ];
      });

    return renderEntries(rootEntries, 0);
  }, [
    childEntriesByPath,
    expandedPaths,
    loadingPath,
    onPathChange,
    rootEntries,
    selectedPath,
    toggleExpand,
  ]);

  return (
    <>
      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void openPicker();
          }}
          disabled={!canBrowse}
          className="w-full justify-start"
        >
          <FolderTree size={16} />
          {selectedPath ? "重新选择真实目录" : "浏览 Worker 真实目录"}
        </Button>
        {!canBrowse ? (
          <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
            请先选择在线 worker。
          </div>
        ) : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="选择工作目录"
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-[#1f2a30] bg-[#05090b] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#111] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  选择工作目录
                </div>
                <div className="text-xs text-gray-500">
                  浏览 {worker?.displayName ?? "当前节点"} 的真实目录树
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void loadRootDirectories();
                  }}
                  aria-label="刷新目录树"
                >
                  <RefreshCw size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label="关闭目录选择"
                >
                  <X size={16} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {displayLoadError ? (
                <div className="mb-3 rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {displayLoadError}
                </div>
              ) : null}

              {loadingRootEntries ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-4 py-8 text-sm text-gray-300">
                  <LoaderCircle size={16} className="animate-spin" />
                  正在读取真实目录...
                </div>
              ) : rootEntries.length > 0 ? (
                <div className="space-y-2">{treeContent}</div>
              ) : (
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-4 py-4 text-sm text-gray-400">
                  当前 worker 没有可浏览的目录根。
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
