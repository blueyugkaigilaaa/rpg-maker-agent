"use client";

import { useEffect, useState, useMemo } from "react";

interface MapMeta {
  mapId: number;
  tilesetId: number;
  width: number;
  height: number;
  hasThumbnail: boolean;
}

const TILESET_LABELS: Record<number, string> = {
  0: "全部",
  1: "室外",
  2: "世界地图",
  3: "室内",
  4: "地下城",
  5: "特殊室外",
  6: "特殊室内",
};

interface Props {
  currentMapId?: number;
  onSelect: (mapId: number) => void;
  onClose: () => void;
}

export default function MapPickerModal({
  currentMapId,
  onSelect,
  onClose,
}: Props) {
  const [maps, setMaps] = useState<MapMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTileset, setFilterTileset] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/assets/map-list")
      .then((r) => r.json())
      .then((data: MapMeta[]) => {
        setMaps(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const tilesetIds = useMemo(() => {
    const ids = new Set(maps.map((m) => m.tilesetId));
    return [0, ...Array.from(ids).sort((a, b) => a - b)];
  }, [maps]);

  const filtered = useMemo(() => {
    let list = maps.filter((m) => m.hasThumbnail);
    if (filterTileset > 0) {
      list = list.filter((m) => m.tilesetId === filterTileset);
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((m) => String(m.mapId).includes(q));
    }
    return list;
  }, [maps, filterTileset, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            选择地图模板
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-3">
          <div className="flex flex-wrap gap-1.5">
            {tilesetIds.map((tid) => (
              <button
                key={tid}
                onClick={() => setFilterTileset(tid)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterTileset === tid
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {TILESET_LABELS[tid] ?? `Tileset ${tid}`}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="搜索地图 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          />
          <span className="text-xs text-gray-400">{filtered.length} 张</span>
        </div>

        {/* Grid */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              没有找到匹配的地图
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((m) => (
                <button
                  key={m.mapId}
                  onClick={() => onSelect(m.mapId)}
                  className={`group relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-md ${
                    m.mapId === currentMapId
                      ? "border-blue-500 ring-2 ring-blue-400/30"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="aspect-square bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/assets/map-thumbnail/${m.mapId}`}
                      alt={`Map ${m.mapId}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">
                        #{m.mapId}
                      </span>
                      <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500">
                        {TILESET_LABELS[m.tilesetId] ?? `T${m.tilesetId}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {m.width}×{m.height}
                    </p>
                  </div>
                  {m.mapId === currentMapId && (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-blue-500 p-0.5">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
