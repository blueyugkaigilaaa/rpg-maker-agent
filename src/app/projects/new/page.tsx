"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;

  async function handleSubmit() {
    if (!name.trim() || !text.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), articleText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        setLoading(false);
        return;
      }
      router.push(`/projects/${data.id}`);
    } catch {
      setError("网络错误");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16">
      <a
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-700"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        返回
      </a>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">新建项目</h1>
      <p className="mb-8 text-gray-500">输入项目名称并粘贴文章，开始生成 RPG 游戏</p>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="projectName"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          项目名称
        </label>
        <input
          id="projectName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：皇帝的新装"
          className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />

        <label
          htmlFor="article"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          文章内容
        </label>
        <textarea
          id="article"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴一篇文章、故事或任意文本..."
          className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-400 transition-colors focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />

        <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
          <span>{charCount.toLocaleString()} 字</span>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !text.trim() || loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 px-6 py-3 font-semibold text-white shadow-md transition-all hover:from-blue-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? (
            <>
              <Spinner />
              创建中...
            </>
          ) : (
            "创建项目"
          )}
        </button>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
