"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function normalizeSessionCode(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

export default function JoinPage() {
  const router = useRouter();

  const [sessionCode, setSessionCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeSessionCode(sessionCode);
    const name = fullName.trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Хуралдааны код яг 6 оронтой тоо байх ёстой.");
      return;
    }
    if (name.length < 2) {
      setError("Жагсаалтад бүртгэгдсэн бүтэн нэрээ оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, fullName: name }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдаанд нэгдэж чадсангүй.");
        return;
      }

      const data: { memberId: string; token: string } = await res.json();

      localStorage.setItem("govsim_member_token", data.token);
      localStorage.setItem("govsim_member_session_code", code);
      localStorage.setItem("govsim_member_id", data.memberId);
      localStorage.setItem("govsim_member_full_name", name);

      router.push(`/session/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10 md:px-8">
      <p className="gov-label text-[#d4bc6a]">Гишүүний нэвтрэлт</p>
      <h1 className="gov-section-title mt-2 text-2xl font-semibold text-[#e8f4fc] md:text-3xl">
        Санал хураалтын хуралдаанд нэгдэх
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#8ab4d8]">
        Дарга олгосон 6 оронтой хуралдааны код болон бүртгэлд гарсан бүтэн нэрээ оруулна уу.
      </p>

      <form className="gov-panel mt-8 space-y-5 p-6" onSubmit={onSubmit}>
        <label className="block">
          <span className="gov-label">Хуралдааны код</span>
          <input
            className="gov-input mt-2 w-full px-3 py-2.5"
            inputMode="numeric"
            placeholder="000000"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            maxLength={8}
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="gov-label">Бүтэн нэр (албан ёсны)</span>
          <input
            className="gov-input mt-2 w-full px-3 py-2.5"
            placeholder="Жагсаалтад байгаа байдлаар"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </label>

        {error ? (
          <p className="rounded border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="gov-btn-primary w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Бүртгэж байна…" : "Хуралдаанд орох"}
        </button>
      </form>
    </div>
  );
}
