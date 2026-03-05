"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import StepStepper, { STAGES, STAGE_INDEX } from "@/components/StepStepper";
import StepResultViewer from "@/components/StepResultViewer";
import ConsolePanel from "@/components/ConsolePanel";
import type { Annotation } from "@/components/AnnotationPopover";

interface ProjectData {
  id: string;
  name: string;
  article_text: string;
  current_stage: string;
  status: string;
  output_path: string | null;
  error: string | null;
  steps: Record<string, unknown>;
  stepTimestamps: Record<string, string>;
}

interface AppConfig {
  model: string;
  reasoningEffort: string;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningStage, setRunningStage] = useState<string | null>(null);
  const [viewStage, setViewStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleText, setConsoleText] = useState("");

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        setError("项目不存在");
        return;
      }
      const data: ProjectData = await res.json();
      setProject(data);
      if (!viewStage) {
        const latestDone = [...STAGES]
          .reverse()
          .find((s) => data.steps[s.key] != null);
        setViewStage(latestDone?.key ?? data.current_stage);
      }
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, [id, viewStage]);

  const loadAnnotations = useCallback(
    async (stage: string) => {
      try {
        const res = await fetch(
          `/api/projects/${id}/annotations?stage=${encodeURIComponent(stage)}`,
        );
        if (res.ok) {
          setAnnotations(await res.json());
        }
      } catch {
        /* ignore */
      }
    },
    [id],
  );

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const activeViewStage = viewStage || project?.current_stage || "text_analysis";

  useEffect(() => {
    if (activeViewStage && project) {
      loadAnnotations(activeViewStage);
    }
  }, [activeViewStage, project, loadAnnotations]);

  async function handleAnnotationCreate(elementPath: string, content: string) {
    await fetch(`/api/projects/${id}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: activeViewStage, elementPath, content }),
    });
    await loadAnnotations(activeViewStage);
  }

  async function handleAnnotationUpdate(
    annId: number,
    fields: { content?: string; status?: string },
  ) {
    await fetch(`/api/projects/${id}/annotations/${annId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await loadAnnotations(activeViewStage);
  }

  async function handleAnnotationDelete(annId: number) {
    await fetch(`/api/projects/${id}/annotations/${annId}`, {
      method: "DELETE",
    });
    await loadAnnotations(activeViewStage);
  }

  async function consumeSSE(res: Response) {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.token != null) {
              setConsoleText((prev) => prev + payload.token);
            } else if (payload.error) {
              setError(payload.error);
              setConsoleText((prev) => prev + `\nERROR: ${payload.error}\n`);
            } else if (payload.result != null) {
              setConsoleText((prev) => prev + "\n--- Complete ---\n");
            }
          } catch {
            /* skip */
          }
        }
      }
    }
  }

  async function handleRunStep(stage?: string) {
    if (running || !project) return;
    const targetStage = stage || project.current_stage;
    setRunning(true);
    setRunningStage(targetStage);
    setError(null);
    setConsoleOpen(true);
    setConsoleText((prev) => prev + `\n--- Running: ${targetStage} ---\n`);

    try {
      const res = await fetch(`/api/projects/${id}/run-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStage }),
      });
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as Record<string, string>).error || "请求失败");
        setRunning(false);
        setRunningStage(null);
        return;
      }
      await consumeSSE(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }

    setRunning(false);
    setRunningStage(null);
    await loadProject();
    setViewStage(null);
  }

  async function handleSyncStep(stage: string) {
    if (running || !project) return;
    setRunning(true);
    setRunningStage(stage);
    setError(null);
    setConsoleOpen(true);
    setConsoleText((prev) => prev + `\n--- Syncing: ${stage} ---\n`);

    try {
      const res = await fetch(`/api/projects/${id}/sync-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as Record<string, string>).error || "同步失败");
        setRunning(false);
        setRunningStage(null);
        return;
      }
      await consumeSSE(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }

    setRunning(false);
    setRunningStage(null);
    await loadProject();
  }

  async function handleAiRevise() {
    if (running || !project) return;
    const activeAnns = annotations.filter((a) => a.status === "active");
    if (activeAnns.length === 0) return;

    setRunning(true);
    setRunningStage(activeViewStage);
    setError(null);
    setConsoleOpen(true);
    setConsoleText(
      (prev) =>
        prev +
        `\n--- AI Revise: ${activeViewStage} (${activeAnns.length} annotations) ---\n`,
    );

    try {
      const res = await fetch(`/api/projects/${id}/ai-revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: activeViewStage }),
      });
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as Record<string, string>).error || "AI 修改请求失败");
        setRunning(false);
        setRunningStage(null);
        return;
      }
      await consumeSSE(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    }

    setRunning(false);
    setRunningStage(null);
    await loadProject();
    await loadAnnotations(activeViewStage);
  }

  async function handleSaveStep(data: string) {
    if (!activeViewStage) return;
    const res = await fetch(`/api/projects/${id}/steps/${activeViewStage}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: data,
    });
    if (!res.ok) throw new Error("保存失败");
    await loadProject();
  }

  async function handleRollback() {
    if (!activeViewStage || !project) return;
    const stageLabel =
      STAGES.find((s) => s.key === activeViewStage)?.label ?? activeViewStage;
    if (
      !confirm(
        `确认回退到「${stageLabel}」？该步骤及之后的所有结果将被清除。`,
      )
    )
      return;

    await fetch(`/api/projects/${id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: activeViewStage }),
    });

    setViewStage(null);
    await loadProject();
  }

  async function handleRebuildProject() {
    if (running || !project) return;
    if (!confirm("确认重新生成工程？将回退最后一步并重新构建。")) return;

    const adapterStage = "rpgmaker_adapter";
    await fetch(`/api/projects/${id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: adapterStage }),
    });

    await loadProject();
    setViewStage(adapterStage);
    await handleRunStep(adapterStage);
  }

  async function handleRegenerateFromStage(fromStage: string) {
    if (running || !project) return;
    const stageLabel =
      STAGES.find((s) => s.key === fromStage)?.label ?? fromStage;
    if (
      !confirm(
        `确认从「${stageLabel}」开始重新生成所有后续步骤？`,
      )
    )
      return;

    await fetch(`/api/projects/${id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: fromStage }),
    });

    await loadProject();
    setViewStage(fromStage);
    await handleRunStep(fromStage);
  }

  if (error && !project) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-8 py-6 text-center">
          <p className="text-lg font-medium text-red-600">{error}</p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-gray-500 underline hover:text-gray-700"
          >
            返回首页
          </a>
        </div>
      </main>
    );
  }

  if (loading || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-500" />
      </main>
    );
  }

  const completedStages = new Set(
    Object.keys(project.steps).filter((k) => project.steps[k] != null),
  );

  const staleStages = computeStaleStages(
    project.stepTimestamps ?? {},
    completedStages,
  );

  const viewData = project.steps[activeViewStage];
  const currentIdx = STAGE_INDEX[activeViewStage] ?? 0;
  const isComplete = project.status === "completed" && staleStages.size === 0;
  const isViewingStale = staleStages.has(activeViewStage);
  const canRun =
    !running &&
    (activeViewStage === project.current_stage || isViewingStale);
  const activeAnnotationCount = annotations.filter(
    (a) => a.status === "active",
  ).length;
  const canRunNext =
    !running &&
    !isComplete &&
    completedStages.has(activeViewStage) &&
    !isViewingStale &&
    activeAnnotationCount === 0 &&
    currentIdx < STAGES.length - 1;
  const canRollback =
    !running && completedStages.has(activeViewStage) && currentIdx > 0;
  const canAiRevise =
    !running && viewData != null && activeAnnotationCount > 0;

  const firstStaleIdx = STAGES.findIndex((s) => staleStages.has(s.key));
  const hasStaleStages = staleStages.size > 0;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-64 pt-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-sm text-gray-400 transition-colors hover:text-gray-700"
          >
            ← 返回
          </a>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              project.status === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : project.status === "error"
                  ? "bg-red-100 text-red-700"
                  : project.status === "running"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-500"
            }`}
          >
            {project.status === "completed"
              ? "已完成"
              : project.status === "error"
                ? "出错"
                : project.status === "running"
                  ? "生成中"
                  : "待处理"}
          </span>
        </div>

        {isComplete && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleRebuildProject}
              disabled={running}
              className="rounded-xl border border-gray-300 px-5 py-2 font-semibold text-gray-600 shadow-sm transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              重新生成工程
            </button>
            <a
              href={`/api/download/${id}`}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-5 py-2 font-semibold text-white shadow-md transition-all hover:from-emerald-400 hover:to-blue-400"
            >
              下载工程
            </a>
          </div>
        )}
      </div>

      {/* Sticky Stepper */}
      <div className="sticky top-0 z-40 -mx-4 mb-6 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-md">
        <StepStepper
          currentStage={runningStage || project.current_stage}
          status={running ? "running" : project.status}
          completedStages={completedStages}
          staleStages={staleStages}
          activeStage={activeViewStage}
          onStageClick={(s) => setViewStage(s)}
        />
      </div>

      {/* Error banner */}
      {(error || project.error) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error || project.error}</p>
        </div>
      )}

      {/* Stale warning banner */}
      {hasStaleStages && !running && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 flex-shrink-0 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm text-amber-700">
              上游步骤已更新，{staleStages.size} 个步骤需要同步。可逐步点击「根据修改同步」，或直接构建（可能报错）。
            </p>
          </div>
          {firstStaleIdx >= 0 && (
            <button
              onClick={() =>
                handleRegenerateFromStage(STAGES[firstStaleIdx].key)
              }
              className="ml-4 flex-shrink-0 rounded-lg border border-amber-300 bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-200"
            >
              全部重新生成
            </button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Sync button — always visible, disabled when not stale */}
        <button
          onClick={() => handleSyncStep(activeViewStage)}
          disabled={!isViewingStale || running}
          className={`rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition-all ${
            isViewingStale && !running
              ? "bg-amber-500 text-white hover:bg-amber-400"
              : "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
          }`}
          title={
            isViewingStale
              ? "根据上游修改，增量同步此步骤（保留手动编辑）"
              : "当前步骤数据是最新的，无需同步"
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            根据修改同步
          </span>
        </button>

        {/* Run / Re-run button */}
        {canRun && (
          <button
            onClick={() => handleRunStep(activeViewStage)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${
              isViewingStale
                ? "border border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-blue-500 hover:bg-blue-400"
            }`}
          >
            {isViewingStale
              ? "完整重新生成"
              : viewData
                ? "重新生成"
                : "运行当前步骤"}
          </button>
        )}

        {canAiRevise && (
          <button
            onClick={handleAiRevise}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-purple-400 hover:to-pink-400"
          >
            AI 按批注修改 ({activeAnnotationCount})
          </button>
        )}

        {canRunNext && (
          <button
            onClick={() => {
              const nextKey = STAGES[currentIdx + 1]?.key;
              if (nextKey) {
                setViewStage(nextKey);
                handleRunStep(nextKey);
              }
            }}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-400"
          >
            下一步 →
          </button>
        )}

        {canRollback && (
          <button
            onClick={handleRollback}
            className="rounded-xl border border-gray-300 px-5 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            回退到此步
          </button>
        )}

        {running && (
          <div className="flex items-center gap-2 text-sm text-blue-500">
            <Spinner className="h-4 w-4" />
            {runningStage === activeViewStage ? "正在同步..." : "正在生成..."}
          </div>
        )}
      </div>

      {/* Stale step inline hint */}
      {isViewingStale && !running && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2">
          <p className="text-xs text-amber-600">
            此步骤的上游数据已更新。点击「根据修改同步」进行增量更新（保留手动编辑），或点击「完整重新生成」从头生成。也可以不同步直接使用，但构建时可能出错。
          </p>
        </div>
      )}

      {/* Step result */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {STAGES.find((s) => s.key === activeViewStage)?.label ??
            activeViewStage}
        </h2>
        <StepResultViewer
          stage={activeViewStage}
          data={viewData}
          allSteps={project.steps}
          projectId={id}
          onProjectReload={loadProject}
          annotations={annotations}
          onSave={handleSaveStep}
          onAnnotationCreate={handleAnnotationCreate}
          onAnnotationUpdate={handleAnnotationUpdate}
          onAnnotationDelete={handleAnnotationDelete}
        />
      </div>

      {/* Console panel */}
      <ConsolePanel
        projectId={id}
        streamText={consoleText}
        open={consoleOpen}
        onToggle={() => setConsoleOpen(!consoleOpen)}
        onClear={() => setConsoleText("")}
        config={config}
      />
    </main>
  );
}

/**
 * A step is "stale" if it has a result but an upstream step's result
 * has a newer timestamp (meaning the upstream was re-generated after this step).
 */
function computeStaleStages(
  stepTimestamps: Record<string, string>,
  completedStages: Set<string>,
): Set<string> {
  const stale = new Set<string>();
  const stageKeys = STAGES.map((s) => s.key);

  for (let i = 1; i < stageKeys.length; i++) {
    const currentKey = stageKeys[i];
    if (!completedStages.has(currentKey)) continue;
    const currentTs = stepTimestamps[currentKey];
    if (!currentTs) continue;

    for (let j = 0; j < i; j++) {
      const upstreamKey = stageKeys[j];
      const upstreamTs = stepTimestamps[upstreamKey];
      if (upstreamTs && upstreamTs > currentTs) {
        stale.add(currentKey);
        break;
      }
    }
  }

  return stale;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
