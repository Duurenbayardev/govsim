"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function normalizeSessionCode(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

export default function ScreenLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openScreen(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeSessionCode(code);
    if (!/^\d{6}$/.test(normalized)) {
      setError("Яг 6 оронтой тоо оруулна уу.");
      return;
    }
    router.push(`/screen/${normalized}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10 md:px-8">
      <p className="gov-label text-[#d4bc6a]">Нийтийн дэлгэц</p>
      <h1 className="gov-section-title mt-2 text-2xl font-semibold text-[#e8f4fc] md:text-3xl">
        Албан ёсны дүнгийн дэлгэц
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#8ab4d8]">
        Дарга харуулсан хуралдааны кодыг оруулж, амьд тоолох хугацаа болон бүртгэгдсэн үр дүнг хуралдаанд
        харуулна.
      </p>

      <form onSubmit={openScreen} className="gov-panel mt-8 space-y-5 p-6">
        <label className="block">
          <span className="gov-label">Хуралдааны код</span>
          <input
            className="gov-input mt-2 w-full px-3 py-2.5"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={8}
            autoComplete="off"
          />
        </label>
        {error ? (
          <p className="rounded border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="gov-btn-primary w-full rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          Дэлгэцийг нээх
        </button>
      </form>
    </div>
  );
}
