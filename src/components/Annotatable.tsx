"use client";

import { useState, useRef, useEffect } from "react";
import AnnotationPopover, { type Annotation } from "@/components/AnnotationPopover";

interface Props {
  elementPath: string;
  annotations: Annotation[];
  onCreate: (path: string, content: string) => Promise<void>;
  onUpdate: (id: number, fields: { content?: string; status?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  children: React.ReactNode;
}

export default function Annotatable({
  elementPath,
  annotations,
  onCreate,
  onUpdate,
  onDelete,
  children,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverMode, setPopoverMode] = useState<"create" | "list">("create");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCount = annotations.filter((a) => a.status === "active").length;
  const totalCount = annotations.length;
  const hasActive = activeCount > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    if (popoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [popoverOpen]);

  function handleElementClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (popoverOpen) return;
    setPopoverMode("create");
    setPopoverOpen(true);
  }

  function handleBadgeClick(e: React.MouseEvent) {
    e.stopPropagation();
    setPopoverMode("list");
    setPopoverOpen(true);
  }

  return (
    <div ref={containerRef} className="group/ann relative">
      {/* Clickable overlay */}
      <div
        onClick={handleElementClick}
        className="cursor-pointer rounded-lg transition-all ring-transparent hover:ring-2 hover:ring-blue-400/30"
      >
        {children}
      </div>

      {/* Badge */}
      {totalCount > 0 && (
        <button
          onClick={handleBadgeClick}
          className={`absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold shadow-md transition-all ${
            hasActive
              ? "bg-blue-500 text-white hover:bg-blue-400"
              : "bg-gray-400 text-white hover:bg-gray-500"
          }`}
        >
          {totalCount}
        </button>
      )}

      {/* Popover */}
      {popoverOpen && (
        <AnnotationPopover
          mode={popoverMode}
          annotations={annotations}
          elementPath={elementPath}
          onClose={() => setPopoverOpen(false)}
          onCreate={async (content) => {
            await onCreate(elementPath, content);
          }}
          onUpdate={async (id, fields) => {
            await onUpdate(id, fields);
          }}
          onDelete={async (id) => {
            await onDelete(id);
          }}
        />
      )}
    </div>
  );
}
