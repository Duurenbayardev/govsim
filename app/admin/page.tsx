"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions/create", { method: "POST" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдаан үүсгэж чадсангүй.");
        return;
      }
      const data: { code: string; adminKey: string } = await res.json();
      setCode(data.code);
      setAdminKey(data.adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 md:px-8">
      <p className="gov-label text-[#d4bc6a]">Удирдлага</p>
      <h1 className="gov-section-title mt-2 text-2xl font-semibold text-[#e8f4fc] md:text-3xl">
        Танхимын удирдлага
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#8ab4d8]">
        Шинэ санал хураалтын хуралдаан үүсгэнэ. Хуралдааны код болон нууц админ түлхүүр олгоно. Түлхүүрийг
        аюулгүй хадгална уу — санал хураалтыг удирдах эрхтэй.
      </p>

      <div className="gov-panel mt-8 p-6">
        <button
          onClick={createSession}
          disabled={loading}
          className="gov-btn-primary w-full rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Хуралдаан гаргаж байна…" : "Шинэ санал хураалтын хуралдаан үүсгэх"}
        </button>
        {error ? (
          <p className="mt-4 rounded border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {code && adminKey ? (
        <div className="gov-panel mt-6 space-y-5 p-6">
          <div className="gov-panel-header -mx-6 -mt-6 mb-2 rounded-t px-6 py-3">
            <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Нэвтрэх мэдээлэл</h2>
            <p className="mt-1 text-xs text-[#8ab4d8]">
              Кодыг гишүүдэд өгнө; түлхүүрийг нууцлан хадгална уу.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="gov-label">Хуралдааны код</div>
              <div className="mt-1 font-mono text-2xl font-semibold tracking-widest text-[#e8f4fc]">
                {code}
              </div>
            </div>
            <div>
              <div className="gov-label">Админ түлхүүр</div>
              <div className="mt-1 break-all font-mono text-sm font-medium text-[#b8d4f0]">{adminKey}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/admin/session/${code}?key=${encodeURIComponent(adminKey)}`}
              className="gov-btn-primary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-center text-sm font-semibold"
            >
              Удирдлагын самбар нээх
            </Link>
            <Link
              href={`/screen/${code}`}
              className="inline-flex items-center justify-center rounded-md border border-[#2a5a8a]/55 bg-[#071a2e]/70 px-4 py-2.5 text-sm font-semibold text-[#c8dff0] hover:bg-[#0a2740]"
            >
              Нийтийн дэлгэц
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
