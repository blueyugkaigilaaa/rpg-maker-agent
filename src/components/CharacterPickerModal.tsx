"use client";

import { useEffect, useState } from "react";

interface FaceFileEntry {
  file: string;
  label: string;
}

function faceLabel(name: string): string {
  if (/^SF_Actor/i.test(name)) return `科幻英雄 ${name.replace(/\D/g, "")}`;
  if (/^Actor/i.test(name)) return `英雄 ${name.replace(/\D/g, "")}`;
  if (/^SF_People/i.test(name)) return `科幻居民 ${name.replace(/\D/g, "")}`;
  if (/^People/i.test(name)) return `居民 ${name.replace(/\D/g, "")}`;
  if (/^SF_Monster/i.test(name)) return "科幻怪物";
  if (/^Evil/i.test(name)) return "反派";
  if (/^Monster/i.test(name)) return "怪物";
  if (/^Nature/i.test(name)) return "自然";
  return name;
}

interface Props {
  currentImage?: string;
  currentIndex?: number;
  onSelect: (faceImage: string, faceIndex: number) => void;
  onClose: () => void;
}

function FaceSprite({
  file,
  index,
  size,
  className,
}: {
  file: string;
  index: number;
  size: number;
  className?: string;
}) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  // Face sheets are 576×288 (4 cols × 2 rows, each face 144×144)
  const scaledSheet = (size / 144) * 576;
  const scaledHeight = (size / 144) * 288;
  const offsetX = col * size;
  const offsetY = row * size;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/api/assets/face-image/${encodeURIComponent(file)})`,
        backgroundSize: `${scaledSheet}px ${scaledHeight}px`,
        backgroundPosition: `-${offsetX}px -${offsetY}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

export { FaceSprite };

export default function CharacterPickerModal({
  currentImage,
  currentIndex,
  onSelect,
  onClose,
}: Props) {
  const [faceFiles, setFaceFiles] = useState<FaceFileEntry[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.assets?.faceFiles) {
          setFaceFiles(
            (cfg.assets.faceFiles as string[]).map((f: string) => ({
              file: f,
              label: faceLabel(f),
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState(-1);

  useEffect(() => {
    if (faceFiles.length === 0) return;
    if (activeTab >= 0) return;
    const found = currentImage
      ? faceFiles.findIndex((f) => f.file === currentImage)
      : 0;
    setActiveTab(found >= 0 ? found : 0);
  }, [faceFiles, currentImage, activeTab]);

  const safeTab = activeTab >= 0 && activeTab < faceFiles.length ? activeTab : 0;

  if (faceFiles.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="rounded-xl bg-white px-8 py-6 text-gray-400">
          加载素材列表...
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            选择角色素材
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

        {/* File tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-6 py-3">
          {faceFiles.map((f, i) => (
            <button
              key={f.file}
              onClick={() => setActiveTab(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                safeTab === i
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Face grid */}
        <div className="px-6 py-6">
          <p className="mb-3 text-xs text-gray-400">
            素材文件: {faceFiles[safeTab].file}
          </p>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, idx) => {
              const file = faceFiles[safeTab].file;
              const isSelected =
                file === currentImage && idx === currentIndex;
              return (
                <button
                  key={idx}
                  onClick={() => onSelect(file, idx)}
                  className={`group relative overflow-hidden rounded-xl border-2 transition-all hover:shadow-md ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-400/30"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <FaceSprite
                    file={file}
                    index={idx}
                    size={120}
                    className="mx-auto rounded-lg"
                  />
                  <div className="px-2 py-1.5 text-center">
                    <span className="text-xs text-gray-500">
                      {file}[{idx}]
                    </span>
                  </div>
                  {isSelected && (
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
