"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [plannedAttendeeCount, setPlannedAttendeeCount] = useState("25");
  const [createdPlannedCount, setCreatedPlannedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const raw = parseInt(plannedAttendeeCount, 10);
      const normalized = Math.max(0, Number.isNaN(raw) ? 0 : raw);
      const res = await fetch("/api/admin/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedAttendeeCount: normalized }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдаан үүсгэж чадсангүй.");
        return;
      }
      const data: { code: string; adminKey: string; plannedAttendeeCount?: number } = await res.json();
      setCode(data.code);
      setAdminKey(data.adminKey);
      setCreatedPlannedCount(data.plannedAttendeeCount ?? normalized);
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
        <label className="block">
          <span className="gov-label">Хуралдаанд оролцох хүний тоо</span>
          <input
            type="number"
            min={0}
            className="gov-input mt-2 w-full px-3 py-2.5"
            value={plannedAttendeeCount}
            onChange={(e) => setPlannedAttendeeCount(e.target.value)}
          />
        </label>
        <button
          onClick={createSession}
          disabled={loading}
          className="gov-btn-primary mt-4 w-full rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
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
              <div className="gov-label">Төлөвлөсөн ирц</div>
              <div className="mt-1 font-mono text-xl font-semibold text-[#e8f4fc]">{createdPlannedCount ?? 0}</div>
            </div>
          </div>

          <div>
            <Link
              href={`/admin/session/${code}?key=${encodeURIComponent(adminKey)}&planned=${encodeURIComponent(String(createdPlannedCount ?? 0))}`}
              className="gov-btn-primary inline-flex items-center justify-center rounded-md px-4 py-2.5 text-center text-sm font-semibold"
            >
              Удирдлагын самбар нээх
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
