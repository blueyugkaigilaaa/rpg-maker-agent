"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { SceneEvent, DialogueLine, DialogueChoice } from "@/pipeline/types";

export interface MapMarker {
  id: string;
  type: "exit" | "spawn" | "npc" | "area_trigger" | "autorun";
  x: number;
  y: number;
  label?: string;
  targetSceneId?: string;
  characterId?: string;
  direction?: 2 | 4 | 6 | 8;
}

interface SceneInfo {
  id: string;
  name: string;
}

interface CharInfo {
  id: string;
  name: string;
}

interface CharAssetInfo {
  characterId: string;
  characterName: string;
  characterImage: string;
  characterIndex: number;
  faceImage?: string;
  faceIndex?: number;
}

interface Props {
  mapId: number;
  initialMarkers: MapMarker[];
  scenes: SceneInfo[];
  characters: CharInfo[];
  charAssets?: CharAssetInfo[];
  sceneEvents?: SceneEvent[];
  projectId?: string;
  onSave: (markers: MapMarker[]) => void;
  onEventUpdate?: (eventId: string, updated: SceneEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onClose: () => void;
}

const MARKER_TYPES: { value: MapMarker["type"]; label: string; color: string }[] = [
  { value: "exit", label: "出入口", color: "#3B82F6" },
  { value: "spawn", label: "出生点", color: "#22C55E" },
  { value: "npc", label: "NPC", color: "#F97316" },
  { value: "area_trigger", label: "区域触发", color: "#A855F7" },
  { value: "autorun", label: "自动事件", color: "#EF4444" },
];

const DIRECTIONS: { value: 2 | 4 | 6 | 8; label: string }[] = [
  { value: 2, label: "下" },
  { value: 4, label: "左" },
  { value: 6, label: "右" },
  { value: 8, label: "上" },
];

const MOVE_TYPE_LABELS: Record<string, string> = {
  fixed: "固定",
  random: "随机",
  approach: "跟随",
};

const MOVE_TYPE_COLORS: Record<string, string> = {
  fixed: "bg-gray-600 text-gray-200",
  random: "bg-cyan-700 text-cyan-200",
  approach: "bg-amber-700 text-amber-200",
};

function extractEventId(markerId: string): string | null {
  const m = markerId.match(/^prefill_(.+)$/);
  return m ? m[1] : null;
}

export default function MapEditorModal({
  mapId,
  initialMarkers,
  scenes,
  characters,
  charAssets,
  sceneEvents,
  projectId,
  onSave,
  onEventUpdate,
  onEventDelete,
  onClose,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [markers, setMarkers] = useState<MapMarker[]>(initialMarkers);
  const [iframeReady, setIframeReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    tileX: number;
    tileY: number;
  } | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [editingMarker, setEditingMarker] = useState<MapMarker | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;

  const eventMap = useMemo(() => {
    const map = new Map<string, SceneEvent>();
    if (sceneEvents) {
      for (const evt of sceneEvents) map.set(evt.id, evt);
    }
    return map;
  }, [sceneEvents]);

  function getEventForMarker(marker: MapMarker): SceneEvent | undefined {
    const evtId = extractEventId(marker.id);
    return evtId ? eventMap.get(evtId) : undefined;
  }

  const sendToIframe = useCallback(
    (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(data, "*");
    },
    [],
  );

  const syncMarkers = useCallback(
    (m: MapMarker[]) => {
      sendToIframe({ type: "setMarkers", markers: m });
    },
    [sendToIframe],
  );

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "ready":
          setIframeReady(true);
          break;
        case "mapLoaded":
          setMapLoaded(true);
          break;
        case "zoomChanged":
          setZoom(msg.zoom);
          break;
        case "tileClick":
          setMenuState({
            x: msg.screenX ?? (msg.x * 48 + 24),
            y: msg.screenY ?? (msg.y * 48 + 24),
            tileX: msg.x,
            tileY: msg.y,
          });
          break;
        case "markerMoved": {
          setMarkers((prev) => {
            const next = prev.map((m) =>
              m.id === msg.id ? { ...m, x: msg.x, y: msg.y } : m,
            );
            syncMarkers(next);
            return next;
          });
          break;
        }
        case "markerDblClick": {
          const found = markersRef.current.find((m) => m.id === msg.id);
          if (found) {
            setSelectedMarkerId(found.id);
            setEditingMarker(found);
            requestAnimationFrame(() => {
              document
                .querySelector(`[data-marker-id="${found.id}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [syncMarkers]);

  useEffect(() => {
    if (iframeReady) {
      sendToIframe({
        type: "init",
        mapId,
        markers,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeReady, mapId, sendToIframe]);

  function addMarker(type: MapMarker["type"], tileX: number, tileY: number) {
    const existing = markers.find((m) => m.x === tileX && m.y === tileY);
    if (existing) {
      setEditingMarker(existing);
      setMenuState(null);
      return;
    }

    const id = `marker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const label = MARKER_TYPES.find((t) => t.value === type)?.label || type;
    const newMarker: MapMarker = {
      id,
      type,
      x: tileX,
      y: tileY,
      label,
      direction: 2,
    };
    const next = [...markers, newMarker];
    setMarkers(next);
    syncMarkers(next);
    setMenuState(null);
    setEditingMarker(newMarker);
  }

  function removeMarker(id: string) {
    const evtId = extractEventId(id);
    if (evtId && onEventDelete) onEventDelete(evtId);
    const next = markers.filter((m) => m.id !== id);
    setMarkers(next);
    syncMarkers(next);
    if (editingMarker?.id === id) setEditingMarker(null);
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  }

  function updateMarker(id: string, fields: Partial<MapMarker>) {
    const next = markers.map((m) =>
      m.id === id ? { ...m, ...fields } : m,
    );
    setMarkers(next);
    syncMarkers(next);
    if (editingMarker?.id === id) {
      setEditingMarker((prev) => (prev ? { ...prev, ...fields } : null));
    }
  }

  function focusMarker(id: string) {
    setSelectedMarkerId(id);
    sendToIframe({ type: "focusMarker", markerId: id });
  }

  function handleSave() {
    onSave(markers);
  }

  useEffect(() => {
    if (!menuState) return;
    const handleClick = () => setMenuState(null);
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClick, { once: true });
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClick);
    };
  }, [menuState]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top toolbar */}
        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">
              Map #{mapId}
            </h2>
            <span className="text-xs text-gray-400">
              {mapLoaded ? "Loaded" : "Loading..."}
            </span>
            <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
              Zoom: {(zoom * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendToIframe({ type: "setZoom", zoom: zoom * 1.3 })}
              className="rounded bg-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-600"
            >
              +
            </button>
            <button
              onClick={() => sendToIframe({ type: "setZoom", zoom: zoom / 1.3 })}
              className="rounded bg-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-600"
            >
              -
            </button>
            <button
              onClick={() => sendToIframe({ type: "fitToView" })}
              className="rounded bg-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-600"
            >
              Fit
            </button>
            <div className="mx-2 h-4 w-px bg-gray-600" />
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-4 py-1 text-xs font-medium text-white hover:bg-blue-500"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>

        {/* Iframe */}
        <div className="relative flex-1">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <iframe
            ref={iframeRef}
            src="/map-editor/index.html"
            className="h-full w-full border-none"
            title="Map Editor"
            tabIndex={0}
          />

          {/* Tile context menu */}
          {menuState && (
            <div
              className="absolute z-50 min-w-[160px] rounded-lg border border-gray-600 bg-gray-800 py-1 shadow-xl"
              style={{
                left: Math.min(menuState.x, window.innerWidth - 200),
                top: Math.min(menuState.y, window.innerHeight - 300),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-gray-700 px-3 py-1.5 text-[10px] text-gray-400">
                Tile ({menuState.tileX}, {menuState.tileY})
              </div>
              {MARKER_TYPES.map((mt) => (
                <button
                  key={mt.value}
                  onClick={() =>
                    addMarker(mt.value, menuState.tileX, menuState.tileY)
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 hover:bg-gray-700"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: mt.color }}
                  />
                  {mt.label}
                </button>
              ))}
              {markers.find(
                (m) => m.x === menuState.tileX && m.y === menuState.tileY,
              ) && (
                <>
                  <div className="my-1 border-t border-gray-700" />
                  <button
                    onClick={() => {
                      const m = markers.find(
                        (mk) =>
                          mk.x === menuState.tileX &&
                          mk.y === menuState.tileY,
                      );
                      if (m) removeMarker(m.id);
                      setMenuState(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700"
                  >
                    Remove marker
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Hint bar */}
        <div className="border-t border-gray-700 bg-gray-900 px-4 py-1.5 text-[10px] text-gray-500">
          Click tile to add marker | Double-click marker to edit | Drag marker to move | Space+Drag / Ctrl+Click / Middle-click to pan | Scroll to zoom
        </div>
      </div>

      {/* Right sidebar */}
      <div className="flex w-80 flex-col border-l border-gray-700 bg-gray-900">
        <div className="border-b border-gray-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Markers ({markers.length})
          </h3>
        </div>

        {/* Marker list */}
        <div className="flex-1 overflow-y-auto p-2">
          {markers.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-gray-500">
              Click on the map to add markers
            </p>
          )}
          {markers.map((m) => {
            const mt = MARKER_TYPES.find((t) => t.value === m.type);
            const evt = getEventForMarker(m);
            const isEditing = editingMarker?.id === m.id;
            const isSelected = selectedMarkerId === m.id || isEditing;
            return (
              <div
                key={m.id}
                data-marker-id={m.id}
                className={`mb-1.5 rounded-lg border p-2 text-xs transition-colors ${
                  isEditing
                    ? "border-blue-400 bg-blue-900/30 ring-1 ring-blue-500/40"
                    : isSelected
                      ? "border-blue-500 bg-gray-800"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => focusMarker(m.id)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: mt?.color || "#888" }}
                    />
                    <span className="font-medium text-gray-200">
                      {m.label || mt?.label || m.type}
                    </span>
                    <span className="text-gray-500">
                      ({m.x},{m.y})
                    </span>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setSelectedMarkerId(m.id);
                        setEditingMarker(m);
                      }}
                      className={`rounded px-1.5 py-0.5 ${
                        isEditing
                          ? "bg-blue-600/30 text-blue-300"
                          : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeMarker(m.id)}
                      className="rounded px-1.5 py-0.5 text-red-400/70 hover:bg-gray-700 hover:text-red-400"
                    >
                      x
                    </button>
                  </div>
                </div>

                {/* Metadata badges */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {m.targetSceneId && (
                    <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] text-blue-300">
                      → {scenes.find((s) => s.id === m.targetSceneId)?.name || m.targetSceneId}
                    </span>
                  )}
                  {m.characterId && (
                    <span className="rounded bg-orange-900/50 px-1.5 py-0.5 text-[10px] text-orange-300">
                      {characters.find((c) => c.id === m.characterId)?.name || m.characterId}
                    </span>
                  )}
                  {evt?.moveType && m.type === "npc" && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${MOVE_TYPE_COLORS[evt.moveType] || "bg-gray-600 text-gray-300"}`}>
                      {MOVE_TYPE_LABELS[evt.moveType] || evt.moveType}
                    </span>
                  )}
                  {evt?.conditions?.switchId != null && (
                    <span className="rounded bg-yellow-900/50 px-1.5 py-0.5 text-[10px] text-yellow-300">
                      SW[{evt.conditions.switchId}]
                    </span>
                  )}
                </div>

                {/* Dialogue preview */}
                {evt?.dialogue && evt.dialogue.lines.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-l-2 border-gray-600 pl-2">
                    {evt.dialogue.lines.slice(0, 3).map((line, k) => (
                      <p key={k} className="truncate text-[10px] text-gray-400">
                        <span className="text-gray-500">{line.speakerCharacterId}:</span>{" "}
                        {line.text}
                      </p>
                    ))}
                    {evt.dialogue.lines.length > 3 && (
                      <p className="text-[10px] text-gray-600">
                        ...+{evt.dialogue.lines.length - 3} lines
                      </p>
                    )}
                    {evt.dialogue.choices && evt.dialogue.choices.length > 0 && (
                      <p className="text-[10px] text-amber-500/70">
                        {evt.dialogue.choices.length} choices
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="border-t border-gray-700 px-4 py-2">
          <p className="mb-1 text-[10px] text-gray-500">Legend</p>
          <div className="flex flex-wrap gap-2">
            {MARKER_TYPES.map((mt) => (
              <span
                key={mt.value}
                className="flex items-center gap-1 text-[10px] text-gray-400"
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: mt.color }}
                />
                {mt.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Marker edit dialog */}
      {editingMarker && (
        <MarkerEditDialog
          marker={editingMarker}
          event={getEventForMarker(editingMarker)}
          scenes={scenes}
          characters={characters}
          charAssets={charAssets}
          sceneEvents={sceneEvents}
          markers={markers}
          projectId={projectId}
          onUpdate={(fields) => updateMarker(editingMarker.id, fields)}
          onEventUpdate={onEventUpdate}
          onClose={() => setEditingMarker(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marker Edit Dialog
// ---------------------------------------------------------------------------

const MOVE_TYPES: { value: string; label: string }[] = [
  { value: "fixed", label: "固定不动" },
  { value: "random", label: "随机移动" },
  { value: "approach", label: "接近玩家" },
];

function buildSkeletonEvent(marker: MapMarker): SceneEvent | null {
  const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, x: marker.x, y: marker.y };
  switch (marker.type) {
    case "npc":
      return {
        ...base,
        type: "npc_dialogue",
        trigger: "action",
        moveType: "fixed",
        characterId: marker.characterId || "",
        dialogue: { id: `dlg_${id}`, lines: [], choices: [] },
      };
    case "area_trigger":
      return {
        ...base,
        type: "area_trigger",
        trigger: "player_touch",
        dialogue: { id: `dlg_${id}`, lines: [] },
      };
    case "autorun":
      return {
        ...base,
        type: "autorun_cutscene",
        trigger: "autorun",
        dialogue: { id: `dlg_${id}`, lines: [] },
      };
    default:
      return null;
  }
}

function MarkerEditDialog({
  marker,
  event,
  scenes,
  characters,
  charAssets,
  sceneEvents,
  markers,
  projectId,
  onUpdate,
  onEventUpdate,
  onClose,
}: {
  marker: MapMarker;
  event?: SceneEvent;
  scenes: SceneInfo[];
  characters: CharInfo[];
  charAssets?: CharAssetInfo[];
  sceneEvents?: SceneEvent[];
  markers?: MapMarker[];
  projectId?: string;
  onUpdate: (fields: Partial<MapMarker>) => void;
  onEventUpdate?: (eventId: string, updated: SceneEvent) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(marker.label || "");
  const [type, setType] = useState(marker.type);
  const [targetSceneId, setTargetSceneId] = useState(marker.targetSceneId || "");
  const [characterId, setCharacterId] = useState(marker.characterId || "");
  const [direction, setDirection] = useState<2 | 4 | 6 | 8>(marker.direction || 2);

  const [editedEvent, setEditedEvent] = useState<SceneEvent | null>(
    event ? { ...event } : buildSkeletonEvent(marker),
  );
  const [expandedChoices, setExpandedChoices] = useState<Set<number>>(new Set());
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function toggleChoiceExpand(idx: number) {
    setExpandedChoices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleSave() {
    const isNewMarker = !marker.id.startsWith("prefill_");
    const updateFields: Partial<MapMarker> = {
      type,
      label: label || undefined,
      targetSceneId: type === "exit" ? targetSceneId || undefined : undefined,
      characterId: type === "npc" ? characterId || undefined : undefined,
      direction,
    };
    // Link marker to event so getEventForMarker can find it
    if (editedEvent && isNewMarker) {
      updateFields.id = `prefill_${editedEvent.id}`;
    }
    onUpdate(updateFields);
    // Sync characterId from form to event so placeNpcDialogue uses it
    if (editedEvent && onEventUpdate) {
      const eventToSave = { ...editedEvent };
      if (type === "npc" && characterId) {
        eventToSave.characterId = characterId;
      }
      onEventUpdate(editedEvent.id, eventToSave);
    }
    onClose();
  }

  function updateDialogueLine(index: number, field: keyof DialogueLine, value: string) {
    if (!editedEvent?.dialogue) return;
    const newLines = [...editedEvent.dialogue.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, lines: newLines },
    });
  }

  function removeDialogueLine(index: number) {
    if (!editedEvent?.dialogue) return;
    const newLines = editedEvent.dialogue.lines.filter((_, i) => i !== index);
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, lines: newLines },
    });
  }

  function addDialogueLine() {
    if (!editedEvent?.dialogue) return;
    const newLines = [
      ...editedEvent.dialogue.lines,
      { speakerCharacterId: "", text: "" },
    ];
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, lines: newLines },
    });
  }

  function updateMoveType(mt: string) {
    if (!editedEvent) return;
    setEditedEvent({ ...editedEvent, moveType: mt as SceneEvent["moveType"] });
  }

  function updateChoice(choiceIdx: number, fields: Partial<DialogueChoice>) {
    if (!editedEvent?.dialogue?.choices) return;
    const newChoices = [...editedEvent.dialogue.choices];
    newChoices[choiceIdx] = { ...newChoices[choiceIdx], ...fields };
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  function addChoice() {
    if (!editedEvent?.dialogue) return;
    const newChoices = [
      ...(editedEvent.dialogue.choices ?? []),
      { text: "", resultDialogue: [] },
    ];
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  function removeChoice(choiceIdx: number) {
    if (!editedEvent?.dialogue?.choices) return;
    const newChoices = editedEvent.dialogue.choices.filter((_, i) => i !== choiceIdx);
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  function updateResultDialogueLine(choiceIdx: number, lineIdx: number, field: keyof DialogueLine, value: string) {
    if (!editedEvent?.dialogue?.choices) return;
    const newChoices = [...editedEvent.dialogue.choices];
    const rd = [...(newChoices[choiceIdx].resultDialogue ?? [])];
    rd[lineIdx] = { ...rd[lineIdx], [field]: value };
    newChoices[choiceIdx] = { ...newChoices[choiceIdx], resultDialogue: rd };
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  function addResultDialogueLine(choiceIdx: number) {
    if (!editedEvent?.dialogue?.choices) return;
    const newChoices = [...editedEvent.dialogue.choices];
    const rd = [...(newChoices[choiceIdx].resultDialogue ?? []), { speakerCharacterId: "", text: "" }];
    newChoices[choiceIdx] = { ...newChoices[choiceIdx], resultDialogue: rd };
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  function removeResultDialogueLine(choiceIdx: number, lineIdx: number) {
    if (!editedEvent?.dialogue?.choices) return;
    const newChoices = [...editedEvent.dialogue.choices];
    const rd = (newChoices[choiceIdx].resultDialogue ?? []).filter((_, i) => i !== lineIdx);
    newChoices[choiceIdx] = { ...newChoices[choiceIdx], resultDialogue: rd };
    setEditedEvent({
      ...editedEvent,
      dialogue: { ...editedEvent.dialogue, choices: newChoices },
    });
  }

  async function handleAiEdit() {
    if (!editedEvent || !projectId || !aiInstruction.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-revise-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: editedEvent, instruction: aiInstruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      setEditedEvent(data.event);
      setAiInstruction("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  }

  const hasEvent = !!editedEvent;
  const hasDialogue = !!editedEvent?.dialogue;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="flex max-h-[85vh] w-[540px] flex-col rounded-xl border border-gray-600 bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Edit Marker ({marker.x}, {marker.y})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {/* Type + Label row */}
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="mb-1 block text-[10px] text-gray-400">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MapMarker["type"])}
                  className="w-full rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {MARKER_TYPES.map((mt) => (
                    <option key={mt.value} value={mt.value}>{mt.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-1/2">
                <label className="mb-1 block text-[10px] text-gray-400">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Optional label"
                  className="w-full rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="mb-1 block text-[10px] text-gray-400">Direction</label>
              <div className="flex gap-1">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDirection(d.value)}
                    className={`flex-1 rounded px-2 py-1 text-xs ${
                      direction === d.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target scene (exit) */}
            {type === "exit" && (
              <div>
                <label className="mb-1 block text-[10px] text-gray-400">Target Scene</label>
                <select
                  value={targetSceneId}
                  onChange={(e) => setTargetSceneId(e.target.value)}
                  className="w-full rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select scene...</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Character (npc) */}
            {type === "npc" && (
              <div>
                <label className="mb-1 block text-[10px] text-gray-400">Character</label>
                <select
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value)}
                  className="w-full rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select character...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Move type (npc only) */}
            {hasEvent && editedEvent!.type === "npc_dialogue" && (
              <div>
                <label className="mb-1 block text-[10px] text-gray-400">NPC 移动模式</label>
                <div className="flex gap-1">
                  {MOVE_TYPES.map((mt) => (
                    <button
                      key={mt.value}
                      onClick={() => updateMoveType(mt.value)}
                      className={`flex-1 rounded px-2 py-1 text-xs ${
                        editedEvent!.moveType === mt.value
                          ? "bg-cyan-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Event content section */}
            {hasDialogue && (
              <div className="border-t border-gray-700 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-medium text-gray-300">
                    对话内容 ({editedEvent!.dialogue!.lines.length} lines)
                  </label>
                  <button
                    onClick={addDialogueLine}
                    className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600"
                  >
                    + 添加对话
                  </button>
                </div>

                <div className="space-y-1.5">
                  {editedEvent!.dialogue!.lines.map((line, i) => (
                    <div key={i} className="flex gap-1">
                      <select
                        value={line.speakerCharacterId}
                        onChange={(e) => updateDialogueLine(i, "speakerCharacterId", e.target.value)}
                        className="w-24 shrink-0 rounded bg-gray-700 px-1 py-1 text-[10px] text-gray-300 outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">说话人...</option>
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input
                        value={line.text}
                        onChange={(e) => updateDialogueLine(i, "text", e.target.value)}
                        placeholder="对话内容..."
                        className="min-w-0 flex-1 rounded bg-gray-700 px-1.5 py-1 text-[10px] text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeDialogueLine(i)}
                        className="shrink-0 rounded px-1 text-[10px] text-red-400/60 hover:bg-gray-700 hover:text-red-400"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>

                {/* Choices - hierarchical */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[10px] font-medium text-gray-300">
                      选项分支 ({editedEvent!.dialogue!.choices?.length ?? 0})
                    </label>
                    <button
                      onClick={addChoice}
                      className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600"
                    >
                      + 添加选项
                    </button>
                  </div>

                  {(editedEvent!.dialogue!.choices ?? []).map((ch, ci) => {
                    const isExpanded = expandedChoices.has(ci);
                    const rdLen = ch.resultDialogue?.length ?? 0;
                    return (
                      <div key={ci} className="mb-1.5 rounded border border-gray-600/60 bg-gray-750">
                        {/* Choice header */}
                        <div className="flex items-center gap-1 px-2 py-1">
                          <button
                            onClick={() => toggleChoiceExpand(ci)}
                            className="shrink-0 text-[10px] text-amber-500 hover:text-amber-400"
                          >
                            {isExpanded ? "▾" : "▸"}
                          </button>
                          <input
                            value={ch.text}
                            onChange={(e) => updateChoice(ci, { text: e.target.value })}
                            placeholder="选项文本..."
                            className="min-w-0 flex-1 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-200 outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="shrink-0 text-[9px] text-gray-500">
                            {rdLen} replies
                          </span>
                          {ch.changeActorImage && (
                            <span className="shrink-0 rounded bg-cyan-700/60 px-1.5 py-0.5 text-[9px] text-cyan-200">
                              换装
                            </span>
                          )}
                          {ch.controlTransferTarget && (
                            <span className="shrink-0 rounded bg-violet-700/60 px-1.5 py-0.5 text-[9px] text-violet-200">
                              控制转移
                            </span>
                          )}
                          <button
                            onClick={() => removeChoice(ci)}
                            className="shrink-0 rounded px-1 text-[10px] text-red-400/60 hover:text-red-400"
                          >
                            x
                          </button>
                        </div>

                        {/* Expanded: resultDialogue lines */}
                        {isExpanded && (
                          <div className="border-t border-gray-600/40 px-2 pb-1.5 pt-1">
                            <div className="space-y-1">
                              {(ch.resultDialogue ?? []).map((rl, ri) => (
                                <div key={ri} className="flex gap-1 pl-3">
                                  <select
                                    value={rl.speakerCharacterId}
                                    onChange={(e) => updateResultDialogueLine(ci, ri, "speakerCharacterId", e.target.value)}
                                    className="w-20 shrink-0 rounded bg-gray-700 px-1 py-0.5 text-[10px] text-gray-300 outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="">说话人...</option>
                                    {characters.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <input
                                    value={rl.text}
                                    onChange={(e) => updateResultDialogueLine(ci, ri, "text", e.target.value)}
                                    placeholder="回复内容..."
                                    className="min-w-0 flex-1 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => removeResultDialogueLine(ci, ri)}
                                    className="shrink-0 rounded px-0.5 text-[10px] text-red-400/60 hover:text-red-400"
                                  >
                                    x
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => addResultDialogueLine(ci)}
                              className="mt-1 ml-3 rounded bg-gray-700 px-2 py-0.5 text-[9px] text-gray-400 hover:bg-gray-600 hover:text-gray-300"
                            >
                              + 添加回复
                            </button>

                            {/* Protagonist costume change */}
                            {charAssets && charAssets.length > 0 && (
                              <div className="mt-2 pl-3">
                                <label className="mb-1 block text-[9px] text-gray-400">
                                  选择后主角换装
                                </label>
                                <select
                                  value={
                                    ch.changeActorImage
                                      ? (charAssets.find(
                                          (c) =>
                                            c.characterImage === ch.changeActorImage?.characterImage &&
                                            c.characterIndex === ch.changeActorImage?.characterIndex,
                                        )?.characterId ?? "")
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const charId = e.target.value;
                                    if (!charId) {
                                      updateChoice(ci, { changeActorImage: undefined });
                                      return;
                                    }
                                    const ca = charAssets.find((c) => c.characterId === charId);
                                    if (ca) {
                                      updateChoice(ci, {
                                        changeActorImage: {
                                          characterImage: ca.characterImage,
                                          characterIndex: ca.characterIndex,
                                          faceImage: ca.faceImage ?? ca.characterImage,
                                          faceIndex: ca.faceIndex ?? ca.characterIndex,
                                        },
                                      });
                                    }
                                  }}
                                  className="w-full rounded bg-gray-700 px-2 py-1 text-[10px] text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                  <option value="">无</option>
                                  {charAssets.map((c) => (
                                    <option key={c.characterId} value={c.characterId}>
                                      {c.characterName} ({c.characterImage}[{c.characterIndex}])
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Control transfer: connect trigger */}
                            {sceneEvents && editedEvent && (
                              <div className="mt-2 pl-3">
                                <label className="mb-1 block text-[9px] text-gray-400">
                                  连接触发 · 控制转移
                                </label>
                                <select
                                  value={ch.controlTransferTarget ?? ""}
                                  onChange={(e) => {
                                    const targetId = e.target.value || undefined;
                                    updateChoice(ci, { controlTransferTarget: targetId });
                                  }}
                                  className="w-full rounded bg-gray-700 px-2 py-1 text-[10px] text-gray-200 outline-none focus:ring-1 focus:ring-violet-500"
                                >
                                  <option value="">无（不触发控制转移）</option>
                                  {sceneEvents
                                    .filter(
                                      (e) =>
                                        e.type === "npc_dialogue" && e.id !== editedEvent?.id,
                                    )
                                    .map((ev) => (
                                      <option key={ev.id} value={ev.id}>
                                        {characters.find((c) => c.id === ev.characterId)?.name ??
                                          ev.id}
                                        {" "}
                                        ({ev.x},{ev.y})
                                      </option>
                                    ))}
                                </select>
                                {ch.controlTransferTarget && (
                                  <p className="mt-0.5 text-[9px] text-violet-300/80">
                                    选择后玩家将操控该角色，原角色停留原地
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Conditions */}
                {editedEvent!.conditions?.switchId != null && (
                  <div className="mt-2 rounded bg-gray-700/50 px-2 py-1.5 text-[10px] text-yellow-300/80">
                    Condition: Switch[{editedEvent!.conditions.switchId}] = {String(editedEvent!.conditions.switchValue ?? true)}
                  </div>
                )}
              </div>
            )}

            {/* AI Edit section */}
            {hasEvent && projectId && (
              <div className="border-t border-gray-700 pt-3">
                <label className="mb-1 block text-[10px] font-medium text-gray-300">
                  AI 编辑
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !aiLoading) {
                        e.preventDefault();
                        handleAiEdit();
                      }
                    }}
                    placeholder="输入修改指令，如：语气改成更正式的..."
                    className="min-w-0 flex-1 rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-200 outline-none placeholder:text-gray-500 focus:ring-1 focus:ring-purple-500"
                    disabled={aiLoading}
                  />
                  <button
                    onClick={handleAiEdit}
                    disabled={aiLoading || !aiInstruction.trim()}
                    className="shrink-0 rounded bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
                  >
                    {aiLoading ? "..." : "AI"}
                  </button>
                </div>
                {aiError && (
                  <p className="mt-1 text-[10px] text-red-400">{aiError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-700 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
