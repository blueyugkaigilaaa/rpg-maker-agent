"use client";

import { useState } from "react";

export interface Annotation {
  id: number;
  project_id: string;
  stage: string;
  element_path: string;
  content: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

interface PopoverProps {
  mode: "create" | "list";
  annotations: Annotation[];
  elementPath: string;
  onClose: () => void;
  onCreate: (content: string) => Promise<void>;
  onUpdate: (id: number, fields: { content?: string; status?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function AnnotationPopover({
  mode: initialMode,
  annotations,
  elementPath,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: PopoverProps) {
  const [mode, setMode] = useState<"create" | "edit" | "list">(initialMode);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      if (mode === "edit" && editingId != null) {
        await onUpdate(editingId, { content: text.trim() });
      } else {
        await onCreate(text.trim());
      }
      setText("");
      setEditingId(null);
      setMode("list");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(ann: Annotation) {
    setText(ann.content);
    setEditingId(ann.id);
    setMode("edit");
  }

  if (mode === "create" || mode === "edit") {
    return (
      <div
        className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            {mode === "edit" ? "编辑批注" : "添加批注"}
          </span>
          <span className="text-xs text-gray-400 font-mono">{elementPath}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入你的修改意见..."
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => {
              if (annotations.length > 0) {
                setMode("list");
                setText("");
                setEditingId(null);
              } else {
                onClose();
              }
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute left-0 top-full z-50 mt-2 w-80 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          批注 ({annotations.length})
        </span>
        <button
          onClick={() => {
            setText("");
            setEditingId(null);
            setMode("create");
          }}
          className="rounded px-2 py-0.5 text-xs text-blue-500 hover:bg-blue-50"
        >
          + 新建
        </button>
      </div>
      <div className="space-y-2">
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className={`rounded-lg border p-2.5 ${
              ann.status === "archived"
                ? "border-gray-100 bg-gray-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-xs leading-relaxed ${
                  ann.status === "archived" ? "text-gray-400 line-through" : "text-gray-700"
                }`}
              >
                {ann.content}
              </p>
              {ann.status === "archived" && (
                <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400">
                  已归档
                </span>
              )}
            </div>
            <div className="mt-1.5 flex gap-2">
              {ann.status === "archived" ? (
                <button
                  onClick={() => onUpdate(ann.id, { status: "active" })}
                  className="text-[10px] text-gray-400 hover:text-gray-700"
                >
                  取消归档
                </button>
              ) : (
                <button
                  onClick={() => startEdit(ann)}
                  className="text-[10px] text-gray-400 hover:text-blue-500"
                >
                  编辑
                </button>
              )}
              <button
                onClick={() => onDelete(ann.id)}
                className="text-[10px] text-gray-400 hover:text-red-500"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
