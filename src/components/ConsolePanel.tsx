"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface LlmLog {
  id: number;
  stage: string;
  system_prompt: string;
  user_prompt: string;
  response_text: string | null;
  duration_ms: number | null;
  token_count: number | null;
  error: string | null;
  created_at: string;
}

interface AppConfig {
  model: string;
  reasoningEffort: string;
}

interface Props {
  projectId: string;
  streamText: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  config?: AppConfig | null;
}

type TabType = "stream" | "logs";

export default function ConsolePanel({
  projectId,
  streamText,
  open,
  onToggle,
  onClear,
  config,
}: Props) {
  const [tab, setTab] = useState<TabType>("stream");
  const [logs, setLogs] = useState<LlmLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/logs`);
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ }
    setLogsLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (open && tab === "logs") loadLogs();
  }, [open, tab, loadLogs]);

  useEffect(() => {
    if (tab === "stream" && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamText, tab]);

  useEffect(() => {
    if (streamText.includes("--- Complete ---") || streamText.includes("--- Step complete ---")) {
      loadLogs();
    }
  }, [streamText, loadLogs]);

  const STAGE_LABELS: Record<string, string> = {
    text_analysis: "文本分析",
    game_design: "游戏设计",
    scene_planning: "场景规划",
    scene_building: "场景构建",
    asset_mapping: "素材映射",
    rpgmaker_adapter: "工程生成",
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all ${
        open ? "h-80" : "h-10"
      }`}
    >
      {/* Header bar */}
      <div className="flex h-10 items-center justify-between border-b border-gray-100 px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
          >
            Console {open ? "▼" : "▲"}
          </button>
          {open && (
            <div className="flex gap-1">
              <TabBtn
                active={tab === "stream"}
                onClick={() => setTab("stream")}
              >
                实时输出
              </TabBtn>
              <TabBtn
                active={tab === "logs"}
                onClick={() => {
                  setTab("logs");
                  loadLogs();
                }}
              >
                LLM 日志
              </TabBtn>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {config.model}
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                reasoning: {config.reasoningEffort}
              </span>
            </>
          )}
          {logs.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700">
              ~{formatTokenCount(logs.reduce((sum, l) => sum + (l.token_count ?? 0), 0))} tokens
            </span>
          )}
          {tab === "stream" && streamText.length > 0 && (
            <button
              onClick={onClear}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            >
              清空
            </button>
          )}
          {tab === "logs" && (
            <button
              onClick={loadLogs}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
            >
              刷新
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {open && (
        <div className="h-[calc(100%-2.5rem)] overflow-auto bg-gray-50/50">
          {tab === "stream" && (
            <div className="p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                {streamText || "Stream output will appear here when running a step..."}
                <div ref={streamEndRef} />
              </pre>
            </div>
          )}

          {tab === "logs" && (
            <div className="p-4">
              {logsLoading ? (
                <p className="text-sm text-gray-400">加载中...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-400">暂无 LLM 调用日志</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const expanded = expandedLog === log.id;
                    const stageName = log.stage.split(":")[0];
                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border border-gray-200 bg-white"
                      >
                        <button
                          onClick={() =>
                            setExpandedLog(expanded ? null : log.id)
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                log.error
                                  ? "bg-red-100 text-red-600"
                                  : "bg-emerald-100 text-emerald-600"
                              }`}
                            >
                              {STAGE_LABELS[stageName] || stageName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {log.duration_ms != null
                                ? `${(log.duration_ms / 1000).toFixed(1)}s`
                                : "—"}
                            </span>
                            {log.stage.includes(":") && (
                              <span className="text-xs text-gray-400">
                                {log.stage.split(":")[1]}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleTimeString("zh-CN")}
                            {expanded ? " ▲" : " ▼"}
                          </span>
                        </button>

                        {expanded && (
                          <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                            <LogSection
                              title="System Prompt"
                              content={log.system_prompt}
                            />
                            <LogSection
                              title="User Prompt"
                              content={log.user_prompt}
                              maxHeight="max-h-40"
                            />
                            {log.response_text && (
                              <LogSection
                                title="Response"
                                content={log.response_text}
                                maxHeight="max-h-60"
                              />
                            )}
                            {log.error && (
                              <div>
                                <span className="text-xs font-medium text-red-500">
                                  Error
                                </span>
                                <p className="mt-1 text-xs text-red-600">
                                  {log.error}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-gray-100 text-gray-800"
          : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {children}
    </button>
  );
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return String(count);
}

function LogSection({
  title,
  content,
  maxHeight = "max-h-32",
}: {
  title: string;
  content: string;
  maxHeight?: string;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{title}</span>
      <pre
        className={`mt-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-xs text-gray-600 ${maxHeight}`}
      >
        {content}
      </pre>
    </div>
  );
}
