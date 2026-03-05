"use client";

const STAGES = [
  { key: "text_analysis", label: "文本分析" },
  { key: "game_design", label: "游戏设计" },
  { key: "scene_planning", label: "场景规划" },
  { key: "scene_building", label: "场景构建" },
  { key: "asset_mapping", label: "素材映射" },
  { key: "rpgmaker_adapter", label: "工程生成" },
] as const;

const STAGE_INDEX: Record<string, number> = {};
STAGES.forEach((s, i) => (STAGE_INDEX[s.key] = i));
STAGE_INDEX["complete"] = STAGES.length;

interface Props {
  currentStage: string;
  status: string;
  completedStages: Set<string>;
  staleStages: Set<string>;
  activeStage: string | null;
  onStageClick: (stage: string) => void;
}

export default function StepStepper({
  currentStage,
  status,
  completedStages,
  staleStages,
  activeStage,
  onStageClick,
}: Props) {
  const currentIdx = STAGE_INDEX[currentStage] ?? 0;
  const isRunning = status === "running";

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const done = completedStages.has(s.key);
        const stale = staleStages.has(s.key);
        const selected = activeStage === s.key;
        const running = isRunning && currentIdx === i;
        const clickable = done || s.key === currentStage;

        return (
          <div key={s.key} className="flex flex-1 items-center">
            <button
              onClick={() => clickable && onStageClick(s.key)}
              disabled={!clickable}
              className={`relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-all disabled:cursor-default ${
                selected
                  ? "bg-blue-50 ring-2 ring-blue-400/60"
                  : "hover:bg-gray-100"
              }`}
              title={stale ? "上游步骤已更新，此步骤结果可能已过时" : undefined}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  running
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                    : stale
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                      : done
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : status === "error" && currentIdx === i
                          ? "bg-red-500 text-white"
                          : selected
                            ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                            : "bg-gray-200 text-gray-400"
                }`}
              >
                {running ? (
                  <svg
                    className="h-5 w-5 animate-spin"
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
                ) : stale ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                ) : done ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`hidden text-center text-xs font-medium sm:block ${
                  running
                    ? "text-blue-600"
                    : stale
                      ? "text-amber-600"
                      : done
                        ? "text-emerald-600"
                        : selected
                          ? "text-blue-600"
                          : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              {stale && (
                <span className="hidden text-[10px] text-amber-500 sm:block">
                  需要同步
                </span>
              )}
            </button>
            {i < STAGES.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded transition-colors ${
                  stale
                    ? "bg-amber-400/50"
                    : completedStages.has(s.key)
                      ? "bg-emerald-400/50"
                      : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { STAGES, STAGE_INDEX };
