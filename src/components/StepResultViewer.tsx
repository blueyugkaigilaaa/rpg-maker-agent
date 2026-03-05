"use client";

import { useState, useMemo } from "react";
import Annotatable from "@/components/Annotatable";
import type { Annotation } from "@/components/AnnotationPopover";
import MapPickerModal from "@/components/MapPickerModal";
import CharacterPickerModal, { FaceSprite } from "@/components/CharacterPickerModal";
import BgmPickerModal from "@/components/BgmPickerModal";
import MapEditorModal from "@/components/MapEditorModal";
import type { MapMarker } from "@/components/MapEditorModal";
import type { SceneEvent } from "@/pipeline/types";

interface Props {
  stage: string;
  data: unknown;
  allSteps?: Record<string, unknown>;
  projectId?: string;
  onProjectReload?: () => Promise<void>;
  annotations: Annotation[];
  onSave: (data: string) => Promise<void>;
  onAnnotationCreate: (path: string, content: string) => Promise<void>;
  onAnnotationUpdate: (id: number, fields: { content?: string; status?: string }) => Promise<void>;
  onAnnotationDelete: (id: number) => Promise<void>;
}

export default function StepResultViewer({
  stage,
  data,
  allSteps,
  projectId,
  onProjectReload,
  annotations,
  onSave,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const annotationsByPath = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of annotations) {
      const list = map.get(a.element_path) ?? [];
      list.push(a);
      map.set(a.element_path, list);
    }
    return map;
  }, [annotations]);

  function getAnns(path: string): Annotation[] {
    return annotationsByPath.get(path) ?? [];
  }

  function startEdit() {
    setEditText(JSON.stringify(data, null, 2));
    setEditing(true);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      JSON.parse(editText);
      await onSave(editText);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-gray-400">
        该步骤尚未执行
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">编辑模式</span>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="h-[500px] w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
      </div>
    );
  }

  const annProps = {
    getAnns,
    onCreate: onAnnotationCreate,
    onUpdate: onAnnotationUpdate,
    onDelete: onAnnotationDelete,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={startEdit}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          编辑 JSON
        </button>
      </div>
      <StructuredView stage={stage} data={data} allSteps={allSteps} projectId={projectId} onProjectReload={onProjectReload} onSave={onSave} {...annProps} />
    </div>
  );
}

interface AnnHelpers {
  getAnns: (path: string) => Annotation[];
  onCreate: (path: string, content: string) => Promise<void>;
  onUpdate: (id: number, fields: { content?: string; status?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function A({
  path,
  children,
  ...helpers
}: { path: string; children: React.ReactNode } & AnnHelpers) {
  return (
    <Annotatable
      elementPath={path}
      annotations={helpers.getAnns(path)}
      onCreate={helpers.onCreate}
      onUpdate={helpers.onUpdate}
      onDelete={helpers.onDelete}
    >
      {children}
    </Annotatable>
  );
}

function StructuredView({ stage, data, allSteps, projectId, onProjectReload, onSave, ...h }: { stage: string; data: unknown; allSteps?: Record<string, unknown>; projectId?: string; onProjectReload?: () => Promise<void>; onSave: (data: string) => Promise<void> } & AnnHelpers) {
  const obj = data as Record<string, unknown>;
  switch (stage) {
    case "text_analysis":
      return <TextAnalysisView data={obj} {...h} />;
    case "game_design":
      return <GameDesignView data={obj} {...h} />;
    case "scene_planning":
      return <ScenePlanView data={obj} {...h} />;
    case "scene_building":
      return <SceneBuildingView data={data as unknown[]} allSteps={allSteps} {...h} />;
    case "asset_mapping":
      return <AssetMappingView data={obj} allSteps={allSteps} projectId={projectId} onProjectReload={onProjectReload} onSave={onSave} {...h} />;
    case "rpgmaker_adapter":
      return <AdapterView data={obj} />;
    default:
      return <JsonFallback data={data} />;
  }
}

function TextAnalysisView({ data, ...h }: { data: Record<string, unknown> } & AnnHelpers) {
  const chars = (data.characters ?? []) as Record<string, unknown>[];
  const locs = (data.locations ?? []) as Record<string, unknown>[];
  const timeline = (data.timeline ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <A path="title" {...h}>
        <InfoCard label="标题" value={String(data.title ?? "")} />
      </A>
      <A path="author" {...h}>
        <InfoCard label="作者" value={String(data.author ?? "")} />
      </A>
      <A path="summary" {...h}>
        <InfoCard label="摘要" value={String(data.summary ?? "")} />
      </A>
      <A path="theme" {...h}>
        <InfoCard label="主题" value={String(data.theme ?? "")} />
      </A>

      <Section title={`角色 (${chars.length})`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {chars.map((c, i) => (
            <A key={i} path={`characters[${i}]`} {...h}>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{String(c.name)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.role === "protagonist"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {String(c.role)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{String(c.description)}</p>
              </div>
            </A>
          ))}
        </div>
      </Section>

      <Section title={`地点 (${locs.length})`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {locs.map((l, i) => (
            <A key={i} path={`locations[${i}]`} {...h}>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <span className="font-medium text-gray-800">{String(l.name)}</span>
                <span className="ml-2 text-xs text-gray-400">{String(l.type)}</span>
                <p className="mt-1 text-xs text-gray-500">{String(l.description)}</p>
              </div>
            </A>
          ))}
        </div>
      </Section>

      <Section title={`时间线 (${timeline.length})`}>
        <div className="space-y-2">
          {timeline.map((t, i) => (
            <A key={i} path={`timeline[${i}]`} {...h}>
              <div className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <span className="shrink-0 text-sm font-bold text-gray-400">
                  {String(t.order ?? i + 1)}
                </span>
                <div>
                  <p className="text-sm text-gray-800">{String(t.description)}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {String(t.emotionalTone)} · {String(t.significance)}
                  </p>
                </div>
              </div>
            </A>
          ))}
        </div>
      </Section>
    </div>
  );
}

function GameDesignView({ data, ...h }: { data: Record<string, unknown> } & AnnHelpers) {
  const anchors = (data.anchorEvents ?? []) as Record<string, unknown>[];
  const decisions = (data.decisionNodes ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <A path="protagonistId" {...h}>
        <InfoCard label="主角 ID" value={String(data.protagonistId ?? "")} />
      </A>
      <A path="estimatedPlaytimeMinutes" {...h}>
        <InfoCard label="预计时长" value={`${data.estimatedPlaytimeMinutes ?? "?"} 分钟`} />
      </A>

      <Section title={`锚点事件 (${anchors.length})`}>
        {anchors.map((a, i) => (
          <A key={i} path={`anchorEvents[${i}]`} {...h}>
            <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <span className="text-sm font-medium text-gray-800">{String(a.id)}</span>
              <p className="mt-1 text-xs text-gray-500">{String(a.description)}</p>
            </div>
          </A>
        ))}
      </Section>

      <Section title={`决策节点 (${decisions.length})`}>
        {decisions.map((d, i) => {
          const opts = (d.options ?? []) as Record<string, unknown>[];
          return (
            <A key={i} path={`decisionNodes[${i}]`} {...h}>
              <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <span className="text-sm font-medium text-gray-800">
                  {String(d.promptText)}
                </span>
                <div className="mt-2 space-y-1">
                  {opts.map((o, j) => (
                    <div key={j} className="ml-3 text-xs text-gray-500">
                      → {String(o.text)}
                    </div>
                  ))}
                </div>
              </div>
            </A>
          );
        })}
      </Section>
    </div>
  );
}

function ScenePlanView({ data, ...h }: { data: Record<string, unknown> } & AnnHelpers) {
  const scenes = (data.scenes ?? []) as Record<string, unknown>[];
  const connections = (data.connections ?? []) as Record<string, unknown>[];
  const startSceneId = String(data.startSceneId ?? "");

  const sceneNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of scenes) m.set(String(s.id), String(s.name));
    return m;
  }, [scenes]);

  return (
    <div className="space-y-4">
      <A path="startSceneId" {...h}>
        <InfoCard
          label="起始场景"
          value={`${startSceneId}${sceneNameMap.has(startSceneId) ? ` — ${sceneNameMap.get(startSceneId)}` : ""}`}
        />
      </A>

      <Section title={`场景 (${scenes.length})`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {scenes.map((s, i) => (
            <A key={i} path={`scenes[${i}]`} {...h}>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{String(s.name)}</span>
                  <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                    {String(s.id)}
                  </span>
                  {String(s.id) === startSceneId && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-600">
                      起始
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-2 text-xs text-gray-400">
                  <span>{String(s.type)}</span>
                  <span>{String(s.size)}</span>
                  <span>{String(s.timeOfDay)}</span>
                </div>
                {s.description ? (
                  <p className="mt-1.5 text-xs text-gray-500">{String(s.description)}</p>
                ) : null}
                <p className="mt-1 text-xs text-gray-400">{String(s.atmosphere)}</p>
                {s.mapTemplateHint ? (
                  <p className="mt-1.5 rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    <span className="text-gray-400">地图模板:</span> {String(s.mapTemplateHint)}
                  </p>
                ) : null}
              </div>
            </A>
          ))}
        </div>
      </Section>

      <Section title={`场景连接图 (${connections.length})`}>
        <ConnectionGraph
          key={JSON.stringify(connections)}
          scenes={scenes}
          connections={connections}
          startSceneId={startSceneId}
          annHelpers={h}
        />
      </Section>
    </div>
  );
}

const TRANSITION_COLORS: Record<string, string> = {
  door: "#3b82f6",
  walk: "#10b981",
  teleport: "#a855f7",
  cutscene: "#f59e0b",
};

function ConnectionGraph({
  scenes,
  connections,
  startSceneId,
  annHelpers,
}: {
  scenes: Record<string, unknown>[];
  connections: Record<string, unknown>[];
  startSceneId: string;
  annHelpers: AnnHelpers;
}) {
  const nodeW = 140;
  const nodeH = 52;
  const padX = 60;
  const padY = 40;

  const nodePositions = useMemo(() => {
    const n = scenes.length;
    if (n === 0) return new Map<string, { x: number; y: number }>();

    const cols = Math.ceil(Math.sqrt(n * 1.5));
    const positions = new Map<string, { x: number; y: number }>();
    scenes.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(String(s.id), {
        x: padX + col * (nodeW + padX),
        y: padY + row * (nodeH + padY * 2),
      });
    });
    return positions;
  }, [scenes]);

  const cols = Math.ceil(Math.sqrt(scenes.length * 1.5));
  const rows = Math.ceil(scenes.length / cols);
  const svgW = padX + cols * (nodeW + padX);
  const svgH = padY + rows * (nodeH + padY * 2);

  const dedupedEdges = useMemo(() => {
    const pairMap = new Map<
      string,
      { from: string; to: string; types: string[]; bidir: boolean; indices: number[] }
    >();
    connections.forEach((c, i) => {
      const from = String(c.fromSceneId);
      const to = String(c.toSceneId);
      const type = String(c.transitionType ?? "walk");
      const key = [from, to].sort().join("|");
      const existing = pairMap.get(key);
      if (existing) {
        if (!existing.types.includes(type)) existing.types.push(type);
        existing.indices.push(i);
        if (existing.from !== from) existing.bidir = true;
      } else {
        pairMap.set(key, { from, to, types: [type], bidir: false, indices: [i] });
      }
    });
    return Array.from(pairMap.values());
  }, [connections]);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block"
      >
        <defs>
          {Object.entries(TRANSITION_COLORS).map(([type, color]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 8"
              refX="10"
              refY="4"
              markerWidth="8"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 4 L0 8 Z" fill={color} />
            </marker>
          ))}
          <marker
            id="arrow-default"
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 4 L0 8 Z" fill="#9ca3af" />
          </marker>
        </defs>

        {/* Edges */}
        {dedupedEdges.map((edge, i) => {
          const pFrom = nodePositions.get(edge.from);
          const pTo = nodePositions.get(edge.to);
          if (!pFrom || !pTo) return null;

          const x1 = pFrom.x + nodeW / 2;
          const y1 = pFrom.y + nodeH / 2;
          const x2 = pTo.x + nodeW / 2;
          const y2 = pTo.y + nodeH / 2;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / len;
          const ny = dy / len;

          const startX = x1 + nx * (nodeW / 2 + 4);
          const startY = y1 + ny * (nodeH / 2 + 4);
          const endX = x2 - nx * (nodeW / 2 + 12);
          const endY = y2 - ny * (nodeH / 2 + 12);

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          const perpX = -ny * 20;
          const perpY = nx * 20;

          const color = TRANSITION_COLORS[edge.types[0]] ?? "#9ca3af";
          const markerId = TRANSITION_COLORS[edge.types[0]]
            ? `arrow-${edge.types[0]}`
            : "arrow-default";

          const path = edge.bidir
            ? `M${startX},${startY} Q${midX + perpX},${midY + perpY} ${endX},${endY}`
            : `M${startX},${startY} Q${midX + perpX * 0.5},${midY + perpY * 0.5} ${endX},${endY}`;

          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                opacity="0.7"
                markerEnd={`url(#${markerId})`}
                markerStart={edge.bidir ? `url(#${markerId})` : undefined}
              />
              <text
                x={midX + perpX * 0.7}
                y={midY + perpY * 0.7}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontSize="9"
                opacity="0.9"
              >
                {edge.types.join(" / ")}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {scenes.map((s) => {
          const id = String(s.id);
          const name = String(s.name);
          const pos = nodePositions.get(id);
          if (!pos) return null;
          const isStart = id === startSceneId;

          return (
            <g key={id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeW}
                height={nodeH}
                rx="8"
                fill={isStart ? "#ecfdf5" : "#f9fafb"}
                stroke={isStart ? "#10b981" : "#d1d5db"}
                strokeWidth={isStart ? "2" : "1"}
              />
              <text
                x={pos.x + nodeW / 2}
                y={pos.y + 18}
                textAnchor="middle"
                fill={isStart ? "#059669" : "#374151"}
                fontSize="12"
                fontWeight="600"
              >
                {name.length > 12 ? name.slice(0, 11) + "…" : name}
              </text>
              <text
                x={pos.x + nodeW / 2}
                y={pos.y + 36}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="9"
                fontFamily="monospace"
              >
                {id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend + annotatable list */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-200 px-2 pt-3">
        {Object.entries(TRANSITION_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: color, opacity: 0.7 }}
            />
            {type}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1 px-2 pb-1">
        {connections.map((c, i) => {
          const fromName =
            scenes.find((s) => String(s.id) === String(c.fromSceneId));
          const toName =
            scenes.find((s) => String(s.id) === String(c.toSceneId));
          return (
            <A key={i} path={`connections[${i}]`} {...annHelpers}>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className="text-gray-600">
                  {fromName ? String(fromName.name) : String(c.fromSceneId)}
                </span>
                <span className="font-mono text-[10px] text-gray-400">
                  ({String(c.fromSceneId)})
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-gray-600">
                  {toName ? String(toName.name) : String(c.toSceneId)}
                </span>
                <span className="font-mono text-[10px] text-gray-400">
                  ({String(c.toSceneId)})
                </span>
                <span
                  className="ml-1 rounded px-1 py-0.5 text-[10px]"
                  style={{
                    backgroundColor:
                      (TRANSITION_COLORS[String(c.transitionType)] ?? "#9ca3af") + "20",
                    color: TRANSITION_COLORS[String(c.transitionType)] ?? "#9ca3af",
                  }}
                >
                  {String(c.transitionType)}
                </span>
                {c.description ? (
                  <span className="text-gray-400"> · {String(c.description)}</span>
                ) : null}
              </div>
            </A>
          );
        })}
      </div>
    </div>
  );
}

function SceneBuildingView({ data, allSteps, ...h }: { data: unknown[]; allSteps?: Record<string, unknown> } & AnnHelpers) {
  if (!Array.isArray(data)) return <JsonFallback data={data} />;

  const sceneNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const scenePlan = allSteps?.scene_planning as Record<string, unknown> | undefined;
    if (scenePlan) {
      const planScenes = (scenePlan.scenes ?? []) as Record<string, unknown>[];
      for (const s of planScenes) map.set(String(s.id), String(s.name ?? ""));
    }
    return map;
  }, [allSteps]);

  const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    npc_dialogue: { bg: "bg-blue-50", text: "text-blue-600", label: "NPC" },
    transfer: { bg: "bg-emerald-50", text: "text-emerald-600", label: "传送" },
    autorun_cutscene: { bg: "bg-amber-50", text: "text-amber-600", label: "过场" },
    area_trigger: { bg: "bg-purple-50", text: "text-purple-600", label: "区域" },
  };

  return (
    <div className="space-y-4">
      {data.map((scene, i) => {
        const s = scene as Record<string, unknown>;
        const events = (s.events ?? []) as Record<string, unknown>[];
        const screenTone = s.screenTone as number[] | undefined;
        const sceneId = String(s.sceneId);
        const sceneName = sceneNameMap.get(sceneId) || "";

        const npcCount = events.filter((e) => e.type === "npc_dialogue").length;
        const transferCount = events.filter((e) => e.type === "transfer").length;
        const autorunCount = events.filter((e) => e.type === "autorun_cutscene").length;
        const triggerCount = events.filter((e) => e.type === "area_trigger").length;

        return (
          <A key={i} path={`[${i}]`} {...h}>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              {/* Scene header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">
                    {sceneName || sceneId}
                  </span>
                  {sceneName && (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {sceneId}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {events.length} events
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {npcCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      NPC {npcCount}
                    </span>
                  )}
                  {transferCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      传送 {transferCount}
                    </span>
                  )}
                  {autorunCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      过场 {autorunCount}
                    </span>
                  )}
                  {triggerCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                      区域 {triggerCount}
                    </span>
                  )}
                </div>
              </div>

              {/* BGM & screen tone */}
              {(s.bgmName || screenTone) ? (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  {s.bgmName ? (
                    <span>BGM: {String(s.bgmName)} (vol {String(s.bgmVolume ?? 90)})</span>
                  ) : null}
                  {screenTone && Array.isArray(screenTone) && (
                    <span>
                      色调: [{screenTone.map(String).join(", ")}]
                      <span
                        className="ml-1 inline-block h-3 w-3 rounded-sm border border-gray-300"
                        style={{
                          backgroundColor: `rgb(${Math.max(0, 128 + (screenTone[0] ?? 0))}, ${Math.max(0, 128 + (screenTone[1] ?? 0))}, ${Math.max(0, 128 + (screenTone[2] ?? 0))})`,
                          opacity: 1 - (screenTone[3] ?? 0) / 255,
                        }}
                      />
                    </span>
                  )}
                </div>
              ) : null}

              {/* Events */}
              <div className="mt-3 space-y-2">
                {events.map((e, j) => {
                  const type = String(e.type);
                  const style = EVENT_TYPE_STYLES[type] ?? {
                    bg: "bg-gray-100",
                    text: "text-gray-500",
                    label: type,
                  };
                  const dialogue = e.dialogue as Record<string, unknown> | undefined;
                  const lines = (dialogue?.lines ?? []) as Record<string, unknown>[];
                  const choices = (dialogue?.choices ?? []) as Record<string, unknown>[];
                  const transfer = e.transfer as Record<string, unknown> | undefined;
                  const conditions = e.conditions as Record<string, unknown> | undefined;

                  return (
                    <div
                      key={j}
                      className={`rounded-lg border border-gray-200/80 p-2.5 ${style.bg}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.text} ${style.bg}`}
                        >
                          {style.label}
                        </span>
                        <span className="font-mono text-xs text-gray-500">
                          {String(e.id)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          ({String(e.x)}, {String(e.y)})
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {String(e.trigger)}
                        </span>
                        {e.characterId ? (
                          <span className="text-[10px] text-gray-500">
                            角色: {String(e.characterId)}
                          </span>
                        ) : null}
                        {conditions?.switchId != null ? (
                          <span className="text-[10px] text-yellow-600">
                            条件: SW[{String(conditions.switchId)}]={String(conditions.switchValue ?? true)}
                          </span>
                        ) : null}
                      </div>

                      {/* Dialogue preview */}
                      {lines.length > 0 && (
                        <div className="mt-1.5 space-y-0.5 border-l-2 border-gray-300 pl-2">
                          {lines.slice(0, 4).map((line, k) => (
                            <p key={k} className="text-xs text-gray-600">
                              <span className="font-medium text-gray-500">
                                {String(line.speakerCharacterId)}:
                              </span>{" "}
                              {String(line.text).length > 80
                                ? String(line.text).slice(0, 77) + "..."
                                : String(line.text)}
                            </p>
                          ))}
                          {lines.length > 4 && (
                            <p className="text-[10px] text-gray-400">
                              ...还有 {lines.length - 4} 行
                            </p>
                          )}
                        </div>
                      )}

                      {/* Choices */}
                      {choices.length > 0 && (
                        <div className="mt-1.5 space-y-0.5 pl-2">
                          {choices.map((ch, k) => (
                            <div key={k} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className="text-amber-500">▸</span>
                              {String(ch.text)}
                              {(ch as { controlTransferTarget?: string }).controlTransferTarget && (
                                <span className="rounded bg-violet-700/50 px-1 py-0.5 text-[10px] text-violet-200">
                                  控制转移
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Transfer target */}
                      {transfer && (
                        <p className="mt-1 text-xs text-emerald-600">
                          → {String(transfer.targetSceneId)} ({String(transfer.targetX)},{String(transfer.targetY)})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </A>
        );
      })}
    </div>
  );
}

function AssetMappingView({
  data,
  allSteps,
  projectId,
  onProjectReload,
  onSave,
  ...h
}: {
  data: Record<string, unknown>;
  allSteps?: Record<string, unknown>;
  projectId?: string;
  onProjectReload?: () => Promise<void>;
  onSave: (data: string) => Promise<void>;
} & AnnHelpers) {
  const chars = (data.characters ?? []) as Record<string, unknown>[];
  const scenes = (data.scenes ?? []) as Record<string, unknown>[];
  const [mapPickerIdx, setMapPickerIdx] = useState<number | null>(null);
  const [charPickerIdx, setCharPickerIdx] = useState<number | null>(null);
  const [bgmPickerIdx, setBgmPickerIdx] = useState<number | null>(null);
  const [mapEditorIdx, setMapEditorIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [playingBgm, setPlayingBgm] = useState<string | null>(null);
  const bgmAudioRef = useState<HTMLAudioElement | null>(null);

  const sceneMetaMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    const scenePlan = allSteps?.scene_planning as Record<string, unknown> | undefined;
    if (scenePlan) {
      const planScenes = (scenePlan.scenes ?? []) as Record<string, unknown>[];
      for (const s of planScenes) {
        map.set(String(s.id), s);
      }
    }
    return map;
  }, [allSteps]);

  function stopBgm() {
    if (bgmAudioRef[0]) {
      bgmAudioRef[0].pause();
      bgmAudioRef[0].src = "";
      bgmAudioRef[1](null);
    }
    setPlayingBgm(null);
  }

  function toggleBgmPreview(bgmName: string) {
    if (playingBgm === bgmName) {
      stopBgm();
      return;
    }
    stopBgm();
    const audio = new Audio(`/api/assets/bgm/${bgmName}`);
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => {});
    bgmAudioRef[1](audio);
    setPlayingBgm(bgmName);
  }

  async function handleMapSelect(sceneIdx: number, newMapId: number) {
    setSaving(true);
    try {
      const newScenes = scenes.map((s, i) =>
        i === sceneIdx ? { ...s, sampleMapId: newMapId } : s,
      );
      await onSave(JSON.stringify({ ...data, scenes: newScenes }));
    } finally {
      setSaving(false);
      setMapPickerIdx(null);
    }
  }

  async function handleBgmSelect(sceneIdx: number, bgmName: string) {
    setSaving(true);
    try {
      const scene = scenes[sceneIdx] as Record<string, unknown>;
      const oldBgm = (scene.bgm ?? {}) as Record<string, unknown>;
      const newBgm = { ...oldBgm, name: bgmName };
      const newScenes = scenes.map((s, i) =>
        i === sceneIdx ? { ...s, bgm: newBgm } : s,
      );
      await onSave(JSON.stringify({ ...data, scenes: newScenes }));
    } finally {
      setSaving(false);
      setBgmPickerIdx(null);
    }
  }

  async function handleCharSelect(
    charIdx: number,
    faceImage: string,
    faceIndex: number,
  ) {
    setSaving(true);
    try {
      const newChars = chars.map((c, i) =>
        i === charIdx
          ? {
              ...c,
              characterImage: faceImage,
              characterIndex: faceIndex,
              faceImage: faceImage,
              faceIndex: faceIndex,
            }
          : c,
      );
      await onSave(JSON.stringify({ ...data, characters: newChars }));
    } finally {
      setSaving(false);
      setCharPickerIdx(null);
    }
  }

  async function handleMarkersSave(sceneIdx: number, markers: MapMarker[]) {
    setSaving(true);
    try {
      const newScenes = scenes.map((s, i) =>
        i === sceneIdx ? { ...s, markers } : s,
      );
      await onSave(JSON.stringify({ ...data, scenes: newScenes }));
    } finally {
      setSaving(false);
      setMapEditorIdx(null);
    }
  }

  const sceneInfoList = useMemo(() => {
    return scenes.map((s) => {
      const sceneId = String(s.sceneId);
      const meta = sceneMetaMap.get(sceneId);
      return { id: sceneId, name: meta ? String(meta.name ?? sceneId) : sceneId };
    });
  }, [scenes, sceneMetaMap]);

  const charInfoList = useMemo(() => {
    return chars.map((c) => ({
      id: String(c.characterId),
      name: String(c.characterName),
    }));
  }, [chars]);

  function buildInitialMarkers(sceneIdx: number): MapMarker[] {
    const scene = scenes[sceneIdx];
    const existing = (scene.markers ?? []) as MapMarker[];
    if (existing.length > 0) return existing;

    // Prefill from scene_building events if available
    const sceneId = String(scene.sceneId);
    const sceneBuilding = allSteps?.scene_building as unknown[] | undefined;
    if (!sceneBuilding) return [];

    const detail = (sceneBuilding as Record<string, unknown>[]).find(
      (d) => String(d.sceneId) === sceneId,
    );
    if (!detail) return [];

    const events = (detail.events ?? []) as Record<string, unknown>[];
    const prefilled: MapMarker[] = [];
    for (const evt of events) {
      const evtType = String(evt.type);
      let markerType: MapMarker["type"] | null = null;
      if (evtType === "transfer") markerType = "exit";
      else if (evtType === "npc_dialogue") markerType = "npc";
      else if (evtType === "autorun_cutscene") markerType = "autorun";
      else if (evtType === "area_trigger") markerType = "area_trigger";
      if (!markerType) continue;

      const id = `prefill_${evt.id || prefilled.length}`;
      const marker: MapMarker = {
        id,
        type: markerType,
        x: Number(evt.x) || 0,
        y: Number(evt.y) || 0,
        direction: (evt.transfer as Record<string, unknown>)?.targetDirection as (2|4|6|8) || 2,
      };
      if (markerType === "exit") {
        const transfer = evt.transfer as Record<string, unknown> | undefined;
        marker.targetSceneId = transfer ? String(transfer.targetSceneId ?? "") : "";
        marker.label = sceneInfoList.find((s) => s.id === marker.targetSceneId)?.name || "Exit";
      } else if (markerType === "npc") {
        marker.characterId = String(evt.characterId ?? "");
        marker.label = charInfoList.find((c) => c.id === marker.characterId)?.name || "NPC";
      }
      prefilled.push(marker);
    }
    return prefilled;
  }

  function getSceneEvents(sceneIdx: number): SceneEvent[] {
    const sceneId = String(scenes[sceneIdx]?.sceneId);
    const sceneBuilding = allSteps?.scene_building as Record<string, unknown>[] | undefined;
    if (!sceneBuilding) return [];
    const detail = sceneBuilding.find((d) => String(d.sceneId) === sceneId);
    if (!detail) return [];
    return (detail.events ?? []) as SceneEvent[];
  }

  async function handleEventUpdate(sceneIdx: number, eventId: string, updated: SceneEvent) {
    const sceneId = String(scenes[sceneIdx]?.sceneId);
    const sceneBuilding = allSteps?.scene_building as Record<string, unknown>[] | undefined;
    if (!sceneBuilding || !projectId) return;

    const detail = sceneBuilding.find((d) => String(d.sceneId) === sceneId);
    const events = (detail?.events ?? []) as SceneEvent[];
    const exists = events.some((e) => e.id === eventId);
    const newEvents = exists
      ? events.map((e) => (e.id === eventId ? updated : e))
      : [...events, updated];

    const newBuilding = detail
      ? sceneBuilding.map((d) =>
          String(d.sceneId) === sceneId ? { ...d, events: newEvents } : d,
        )
      : [...sceneBuilding, { sceneId, events: newEvents }];

    try {
      const res = await fetch(`/api/projects/${projectId}/steps/scene_building`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBuilding),
      });
      if (res.ok && onProjectReload) {
        await onProjectReload();
      } else if (!res.ok) {
        console.error("Failed to save event update");
      }
    } catch (err) {
      console.error("Failed to save event update", err);
    }
  }

  async function handleEventDelete(sceneIdx: number, eventId: string) {
    const sceneId = String(scenes[sceneIdx]?.sceneId);
    const sceneBuilding = allSteps?.scene_building as Record<string, unknown>[] | undefined;
    if (!sceneBuilding || !projectId) return;

    const detail = sceneBuilding.find((d) => String(d.sceneId) === sceneId);
    if (!detail) return;
    const events = (detail.events ?? []) as SceneEvent[];
    const newEvents = events.filter((e) => e.id !== eventId);
    const newBuilding = sceneBuilding.map((d) =>
      String(d.sceneId) === sceneId ? { ...d, events: newEvents } : d,
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/steps/scene_building`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBuilding),
      });
      if (res.ok && onProjectReload) {
        await onProjectReload();
      } else if (!res.ok) {
        console.error("Failed to save event delete");
      }
    } catch (err) {
      console.error("Failed to save event delete", err);
    }
  }

  const TILESET_LABELS: Record<number, string> = {
    1: "室外", 2: "世界地图", 3: "室内", 4: "地下城", 5: "特殊室外", 6: "特殊室内",
  };

  // Derive connections from exit markers so the graph updates when user edits links in map editor
  const derivedConnections = useMemo(() => {
    const conns: Record<string, unknown>[] = [];
    const planScenes = (allSteps?.scene_planning as Record<string, unknown>)?.scenes as Record<string, unknown>[] | undefined;
    if (!planScenes) return conns;
    for (const s of scenes) {
      const sceneId = String((s as Record<string, unknown>).sceneId);
      const markers = ((s as Record<string, unknown>).markers ?? []) as Record<string, unknown>[];
      for (const m of markers) {
        if (m.type === "exit" && m.targetSceneId) {
          conns.push({
            fromSceneId: sceneId,
            toSceneId: String(m.targetSceneId),
            transitionType: "walk",
            description: m.label,
          });
        }
      }
    }
    return conns;
  }, [scenes, allSteps]);

  const planScenes = (allSteps?.scene_planning as Record<string, unknown>)?.scenes as Record<string, unknown>[] ?? [];
  const startSceneId = String((allSteps?.scene_planning as Record<string, unknown>)?.startSceneId ?? "");

  return (
    <div className="space-y-4">
      {saving && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
          保存中...
        </div>
      )}

      {planScenes.length > 0 && (
        <Section title={`场景连接图 (${derivedConnections.length}) — 根据地图出口`}>
          <ConnectionGraph
            key={JSON.stringify(derivedConnections)}
            scenes={planScenes}
            connections={derivedConnections}
            startSceneId={startSceneId}
            annHelpers={h}
          />
        </Section>
      )}

      <Section title={`角色素材 (${chars.length})`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {chars.map((c, i) => (
            <A key={i} path={`characters[${i}]`} {...h}>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <FaceSprite
                  file={String(c.faceImage || c.characterImage || "")}
                  index={Number(c.faceIndex ?? c.characterIndex ?? 0)}
                  size={64}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-800">
                    {String(c.characterName)}
                  </span>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {String(c.characterImage)}[{String(c.characterIndex)}]
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                    {String(c.characterId)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCharPickerIdx(i);
                  }}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                >
                  更换
                </button>
              </div>
            </A>
          ))}
        </div>
      </Section>

      <Section title={`场景素材 (${scenes.length})`}>
        <div className="space-y-3">
          {scenes.map((s, i) => {
            const bgm = s.bgm as Record<string, unknown> | undefined;
            const bgmName = bgm ? String(bgm.name ?? "") : "";
            const mapId = s.sampleMapId as number | undefined;
            const sceneId = String(s.sceneId);
            const meta = sceneMetaMap.get(sceneId);
            const sceneName = meta ? String(meta.name ?? "") : "";
            const sceneDesc = meta ? String(meta.description ?? "") : "";
            const sceneType = meta ? String(meta.type ?? "") : "";
            const sceneAtmosphere = meta ? String(meta.atmosphere ?? "") : "";
            const sceneTimeOfDay = meta ? String(meta.timeOfDay ?? "") : "";
            const isBgmPlaying = playingBgm === bgmName && bgmName !== "";

            return (
              <A key={i} path={`scenes[${i}]`} {...h}>
                <div className="flex gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {/* Map thumbnail */}
                  <div className="shrink-0">
                    {mapId ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/assets/map-thumbnail/${mapId}`}
                          alt={`Map ${mapId}`}
                          className="h-28 w-36 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-28 w-36 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-100 text-xs text-gray-400">
                        无地图
                      </div>
                    )}
                  </div>

                  {/* Scene info */}
                  <div className="min-w-0 flex-1">
                    {/* Scene name + id */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {sceneName || sceneId}
                      </span>
                      {sceneName && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                          {sceneId}
                        </span>
                      )}
                    </div>

                    {/* Scene description */}
                    {sceneDesc && (
                      <p className="mt-1 text-xs text-gray-500">{sceneDesc}</p>
                    )}

                    {/* Scene type / atmosphere tags */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                      {sceneType && (
                        <span className={`rounded px-1.5 py-0.5 ${
                          sceneType === "indoor"
                            ? "bg-violet-100 text-violet-600"
                            : "bg-green-100 text-green-600"
                        }`}>
                          {sceneType === "indoor" ? "室内" : "室外"}
                        </span>
                      )}
                      {sceneTimeOfDay && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-600">
                          {sceneTimeOfDay}
                        </span>
                      )}
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-500">
                        {TILESET_LABELS[Number(s.tilesetId)] ?? `Tileset ${String(s.tilesetId)}`}
                      </span>
                      {mapId && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-600">
                          Map #{mapId}
                        </span>
                      )}
                      {Array.isArray(s.markers) && s.markers.length > 0 && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-600">
                          {(s.markers as unknown[]).length} markers
                        </span>
                      )}
                    </div>
                    {sceneAtmosphere && (
                      <p className="mt-1 text-[10px] italic text-gray-400">{sceneAtmosphere}</p>
                    )}

                    {/* BGM row */}
                    <div className="mt-2 flex items-center gap-2">
                      {bgmName ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBgmPreview(bgmName);
                            }}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                              isBgmPlaying
                                ? "bg-amber-500 text-white"
                                : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                            }`}
                            title={isBgmPlaying ? "停止试听" : "试听"}
                          >
                            {isBgmPlaying ? (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                              </svg>
                            ) : (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                          <span className="text-xs text-amber-700">
                            BGM: {bgmName}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">未设置 BGM</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBgmPickerIdx(i);
                        }}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-500 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                      >
                        更换 BGM
                      </button>
                    </div>

                    {/* Map change / edit buttons */}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMapPickerIdx(i);
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      >
                        更换地图
                      </button>
                      {mapId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapEditorIdx(i);
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          编辑地图
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </A>
            );
          })}
        </div>
      </Section>

      {/* Map picker modal */}
      {mapPickerIdx != null && (
        <MapPickerModal
          currentMapId={scenes[mapPickerIdx]?.sampleMapId as number | undefined}
          onSelect={(mapId) => handleMapSelect(mapPickerIdx, mapId)}
          onClose={() => setMapPickerIdx(null)}
        />
      )}

      {/* Character picker modal */}
      <CharPickerBridge
        charPickerIdx={charPickerIdx}
        chars={chars}
        onSelect={handleCharSelect}
        onClose={() => setCharPickerIdx(null)}
      />

      {/* BGM picker modal */}
      {bgmPickerIdx != null && (
        <BgmPickerModal
          currentBgm={
            (() => {
              const bgm = scenes[bgmPickerIdx]?.bgm as Record<string, unknown> | undefined;
              return bgm ? String(bgm.name ?? "") : "";
            })()
          }
          onSelect={(bgmName) => handleBgmSelect(bgmPickerIdx, bgmName)}
          onClose={() => setBgmPickerIdx(null)}
        />
      )}

      {/* Map editor modal */}
      {mapEditorIdx != null && Number(scenes[mapEditorIdx]?.sampleMapId) > 0 && (
        <MapEditorModal
          mapId={Number(scenes[mapEditorIdx].sampleMapId)}
          initialMarkers={buildInitialMarkers(mapEditorIdx)}
          scenes={sceneInfoList}
          characters={charInfoList}
          charAssets={chars.map((c: Record<string, unknown>) => ({
            characterId: String(c.characterId ?? ""),
            characterName: String(c.characterName ?? ""),
            characterImage: String(c.characterImage ?? ""),
            characterIndex: Number(c.characterIndex ?? 0),
            faceImage: c.faceImage != null ? String(c.faceImage) : undefined,
            faceIndex: c.faceIndex != null ? Number(c.faceIndex) : undefined,
          }))}
          sceneEvents={getSceneEvents(mapEditorIdx)}
          projectId={projectId}
          onSave={(markers) => handleMarkersSave(mapEditorIdx, markers)}
          onEventUpdate={(eventId, updated) => handleEventUpdate(mapEditorIdx, eventId, updated)}
          onEventDelete={(eventId) => handleEventDelete(mapEditorIdx, eventId)}
          onClose={() => setMapEditorIdx(null)}
        />
      )}
    </div>
  );
}

function AdapterView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <InfoCard label="输出路径" value={String(data.outputPath ?? "")} />
      <p className="text-sm text-emerald-600">RPG Maker MZ 工程已生成完毕。</p>
    </div>
  );
}

function JsonFallback({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[500px] overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function CharPickerBridge({
  charPickerIdx,
  chars,
  onSelect,
  onClose,
}: {
  charPickerIdx: number | null;
  chars: Record<string, unknown>[];
  onSelect: (idx: number, img: string, fidx: number) => void;
  onClose: () => void;
}) {
  if (charPickerIdx == null) return null;
  const c = chars[charPickerIdx];
  return (
    <CharacterPickerModal
      currentImage={String(c?.faceImage || c?.characterImage || "")}
      currentIndex={Number(c?.faceIndex ?? c?.characterIndex ?? 0)}
      onSelect={(img, idx) => onSelect(charPickerIdx, img, idx)}
      onClose={onClose}
    />
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-500">{title}</h3>
      {children}
    </div>
  );
}
