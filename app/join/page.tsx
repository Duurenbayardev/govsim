"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function normalizeSessionCode(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

const MEMBER_NAME_PATTERN = /^[А-ЯӨҮЁ][а-яөүё]+\.[А-ЯӨҮЁ]$/u;

export default function JoinPage() {
  const router = useRouter();

  const [sessionCode, setSessionCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeFromQr, setCodeFromQr] = useState("");

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    setCodeFromQr(qp.get("code") ?? "");
  }, []);

  useEffect(() => {
    if (!codeFromQr) return;
    setSessionCode(normalizeSessionCode(codeFromQr));
  }, [codeFromQr]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeSessionCode(codeFromQr || sessionCode);
    const name = fullName.trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Хуралдааны код яг 6 оронтой тоо байх ёстой.");
      return;
    }
    if (!MEMBER_NAME_PATTERN.test(name)) {
      setError("Нэрийг Батмөнх.А хэлбэрээр оруулна уу.");
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
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/");
        }}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/45 bg-[#005180]/60 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Буцах
      </button>
      <p className="gov-label text-white/80">Гишүүний нэвтрэлт</p>
      <h1 className="gov-section-title mt-2 text-2xl font-semibold text-white md:text-3xl">
        Санал хураалтын хуралдаанд нэгдэх
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        Дарга олгосон 6 оронтой хуралдааны код болон бүртгэлд гарсан бүтэн нэрээ оруулна уу.
      </p>

      <form
        className="mt-8 space-y-5 rounded-xl border border-white/30 bg-[#0077b8]/55 p-6 backdrop-blur-sm"
        onSubmit={onSubmit}
      >
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
            disabled={!!codeFromQr}
          />
          {codeFromQr ? <p className="mt-1 text-xs text-white/75">QR-аар код автоматаар бөглөгдсөн.</p> : null}
        </label>

        <label className="block">
          <span className="gov-label">Бүтэн нэр (албан ёсны)</span>
          <input
            className="gov-input mt-2 w-full px-3 py-2.5"
            placeholder="Жишээ: Батмөнх.А"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
          <p className="mt-1 text-xs text-white/75">Формат: Овог.Н (ж: Батмөнх.А)</p>
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
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full rounded-md border border-white/45 bg-[#005180]/60 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00659d]"
        >
          Нүүр хуудас
        </button>
      </form>
    </div>
  );
}
