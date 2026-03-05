"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

interface BgmEntry {
  name: string;
  label: string;
  category: string;
}

const CATEGORY_MAP: Record<string, string> = {
  battle: "战斗",
  castle: "城堡",
  dungeon: "地下城",
  field: "原野",
  "scene/cutscene": "剧情",
  "ship/sailing": "航海",
  "title/theme": "主题",
  town: "城镇",
  other: "其他",
};

function bgmLabel(name: string): string {
  return name;
}

interface Props {
  currentBgm?: string;
  onSelect: (bgmName: string) => void;
  onClose: () => void;
}

export default function BgmPickerModal({
  currentBgm,
  onSelect,
  onClose,
}: Props) {
  const [bgmList, setBgmList] = useState<BgmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("全部");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.assets?.bgmFiles) {
          const entries: BgmEntry[] = (
            cfg.assets.bgmFiles as { name: string; category: string }[]
          ).map((b) => ({
            name: b.name,
            label: bgmLabel(b.name),
            category: CATEGORY_MAP[b.category] || b.category,
          }));
          setBgmList(entries);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(bgmList.map((b) => b.category));
    return ["全部", ...Array.from(cats).sort()];
  }, [bgmList]);

  const filtered =
    category === "全部"
      ? bgmList
      : bgmList.filter((b) => b.category === category);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlaying(null);
  }, []);

  function togglePlay(bgmName: string) {
    if (playing === bgmName) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(`/api/assets/bgm/${bgmName}`);
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => setPlaying(null);
    audioRef.current = audio;
    setPlaying(bgmName);
  }

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  function handleSelect(bgmName: string) {
    stopAudio();
    onSelect(bgmName);
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="rounded-xl bg-white px-8 py-6 text-gray-400">
          加载 BGM 列表...
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopAudio();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">选择背景音乐</h2>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-6 py-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* BGM list */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-3">
          <div className="space-y-1">
            {filtered.map((bgm) => {
              const isPlaying = playing === bgm.name;
              const isCurrent = bgm.name === currentBgm;
              return (
                <div
                  key={bgm.name}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    isCurrent
                      ? "border border-blue-200 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Play/Stop button */}
                  <button
                    onClick={() => togglePlay(bgm.name)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isPlaying
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600"
                    }`}
                  >
                    {isPlaying ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {bgm.label}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                        {bgm.category}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                          当前
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    onClick={() => handleSelect(bgm.name)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-blue-500 text-white"
                        : "border border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                    }`}
                  >
                    {isCurrent ? "已选择" : "选择"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
