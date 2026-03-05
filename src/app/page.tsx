"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  current_stage: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  text_analysis: "文本分析",
  game_design: "游戏设计",
  scene_planning: "场景规划",
  scene_building: "场景构建",
  asset_mapping: "素材映射",
  rpgmaker_adapter: "工程生成",
  complete: "已完成",
  error: "出错",
};

const STATUS_STYLES: Record<string, string> = {
  idle: "bg-gray-200 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "待处理",
  running: "生成中",
  paused: "已暂停",
  completed: "已完成",
  error: "出错",
};

interface AppConfig {
  model: string;
  reasoningEffort: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确定删除项目「${name}」？此操作不可恢复。`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RPG Maker Agent</h1>
          <p className="mt-1 text-gray-500">
            一篇文章，变成一款可以玩的 RPG 游戏
          </p>
          {config && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {config.model}
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                reasoning: {config.reasoningEffort}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => router.push("/projects/new")}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:from-blue-400 hover:to-emerald-400"
        >
          + 新建项目
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-blue-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-8 py-20 text-center">
          <p className="text-lg text-gray-400">还没有项目</p>
          <p className="mt-2 text-sm text-gray-400">
            点击「新建项目」开始生成你的第一款 RPG 游戏
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              onClick={() => router.push(`/projects/${p.id}`)}
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                  {p.name}
                </h3>
                <span
                  className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] || STATUS_STYLES.idle}`}
                >
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>

              <p className="text-sm text-gray-500">
                当前阶段：{STAGE_LABELS[p.current_stage] || p.current_stage}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {new Date(p.created_at).toLocaleString("zh-CN")}
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id, p.name);
                }}
                className="absolute right-3 top-3 hidden rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:block"
                title="删除项目"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
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
