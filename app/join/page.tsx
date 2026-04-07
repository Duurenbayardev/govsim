"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  MONGOLIAN_CYRILLIC_UPPER_LETTERS,
  capitalizeFirstLetterOnly,
  filterMongolianNameInput,
} from "@/lib/mongolianJoinName";

function normalizeSessionCode(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return digits.padStart(6, "0");
}

export default function JoinPage() {
  const router = useRouter();

  const [sessionCode, setSessionCode] = useState("");
  const [namePart, setNamePart] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [letterPickerOpen, setLetterPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeFromQr, setCodeFromQr] = useState("");
  const [isPageVisible, setIsPageVisible] = useState(false);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    setCodeFromQr(qp.get("code") ?? "");
    setTimeout(() => setIsPageVisible(true), 10);
  }, []);

  useEffect(() => {
    if (!codeFromQr) return;
    setSessionCode(normalizeSessionCode(codeFromQr));
  }, [codeFromQr]);

  useEffect(() => {
    if (!letterPickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLetterPickerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [letterPickerOpen]);

  const onNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNamePart(filterMongolianNameInput(e.target.value));
  }, []);

  const onNameBlur = useCallback(() => {
    setNamePart((prev) => capitalizeFirstLetterOnly(prev));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeSessionCode(codeFromQr || sessionCode);
    const name = capitalizeFirstLetterOnly(namePart);

    if (!/^\d{6}$/.test(code)) {
      setError("Хуралдааны код яг 6 оронтой тоо байх ёстой.");
      return;
    }
    if (!name.trim()) {
      setError("Нэрээ оруулна уу.");
      return;
    }
    if (!letter) {
      setError("Овгийн эхний үсгээ сонгоно уу.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, letter }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Хуралдаанд нэгдэж чадсангүй.");
        return;
      }

      const data: { memberId: string; token: string } = await res.json();
      const storedFullName = `${name}.${letter}`;

      localStorage.setItem("govsim_member_token", data.token);
      localStorage.setItem("govsim_member_session_code", code);
      localStorage.setItem("govsim_member_id", data.memberId);
      localStorage.setItem("govsim_member_full_name", storedFullName);

      router.push(`/session/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-lg items-center px-5 py-10 md:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[50%] w-[50%] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/3 h-[30%] w-[30%] rounded-full bg-purple-600/10 blur-[100px] animate-pulse-glow-delayed" />
      </div>

      <div
        className={`relative z-10 w-full transition-all duration-700 ease-out ${
          isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="group mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 transition-all duration-300 hover:text-white hover:translate-x-[-4px] active:scale-95 cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Буцах
        </button>

        <div className="mb-8">
          <div
            className={`inline-block rounded-lg bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 ring-1 ring-blue-500/20 transition-all duration-500 hover:scale-105 hover:bg-blue-500/20 ${
              isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            Membership Access
          </div>
          <h1
            className={`oswald-ui mt-4 text-3xl font-bold text-white md:text-5xl transition-all duration-500 ${
              isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            ХУРАЛДААНД НЭГДЭХ
          </h1>
          <p
            className={`mt-3 text-sm leading-relaxed text-white/50 transition-all duration-500 ${
              isPageVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            Хуралдааны код болон бүртгэлийн мэдээллээ оруулна уу.
          </p>
        </div>

        <form
          className={`space-y-5 rounded-[2.5rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl transition-all duration-700 ${
            isPageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: "250ms" }}
          onSubmit={onSubmit}
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
              Хуралдааны код
            </label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xl font-bold tracking-[0.3em] text-white outline-none transition-all duration-300 hover:scale-[1.02] hover:border-white/20 focus:border-blue-500/50 focus:scale-[1.02] focus:bg-white/10 disabled:opacity-50"
              inputMode="numeric"
              placeholder="000000"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              maxLength={8}
              autoComplete="off"
              disabled={!!codeFromQr}
            />
            {codeFromQr && (
              <p className="text-[10px] text-emerald-400/80 ml-1 font-medium animate-fade-in-up">
                ✓ QR код идэвхжсэн
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
              Нэр
            </label>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-medium text-white outline-none transition-all duration-300 hover:scale-[1.02] hover:border-white/20 focus:border-blue-500/50 focus:scale-[1.02] focus:bg-white/10"
              placeholder="Нэр"
              value={namePart}
              onChange={onNameChange}
              onBlur={onNameBlur}
              autoComplete="name"
              lang="mn"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
              Овгийн эхний үсэг
            </label>
            <button
              type="button"
              onClick={() => setLetterPickerOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-lg font-bold text-white outline-none transition-all duration-300 hover:border-white/20 focus:border-blue-500/50 focus:bg-white/10"
            >
              <span className={letter ? "text-white" : "text-white/35"}>
                {letter ?? "Цагаан толгооноос сонгох…"}
              </span>
              <span className="text-white/40 text-sm" aria-hidden>
                ▼
              </span>
            </button>

            {letterPickerOpen ? (
              <div
                className="join-letter-modal-root fixed inset-0 z-[100] flex items-center justify-center p-4"
                role="presentation"
              >
                <button
                  type="button"
                  className="join-letter-modal-backdrop absolute inset-0 border-0 bg-black/60 backdrop-blur-[3px]"
                  aria-label="Хаах"
                  onClick={() => setLetterPickerOpen(false)}
                />
                <div
                  className="join-letter-modal-panel relative z-10 w-full max-w-md max-h-[min(60vh,400px)] overflow-y-auto rounded-2xl border border-white/15 bg-[#0f172a]/98 p-4 shadow-2xl"
                  role="listbox"
                  aria-label="Монгол үсэг"
                >
                  <div className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-white/45">
                    Үсэг сонгох
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7">
                    {MONGOLIAN_CYRILLIC_UPPER_LETTERS.map((L) => (
                      <button
                        key={L}
                        type="button"
                        role="option"
                        aria-selected={letter === L}
                        onClick={() => {
                          setLetter(L);
                          setLetterPickerOpen(false);
                        }}
                        className={[
                          "rounded-lg py-2.5 text-center text-base font-bold transition-colors duration-150",
                          letter === L
                            ? "bg-blue-500 text-white"
                            : "bg-white/10 text-white hover:bg-white/25 active:scale-95",
                        ].join(" ")}
                      >
                        {L}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error && (
            <div className="rounded-2xl text-xs font-medium text-red-400 animate-shake">{error}</div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="relative h-14 w-full rounded-2xl bg-white text-sm font-black uppercase tracking-widest text-slate-950 overflow-hidden transition-all duration-300 hover:bg-blue-400 hover:text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              <span
                className={`inline-flex items-center justify-center gap-2 transition-all duration-300 ${
                  loading ? "opacity-0 translate-y-8" : "opacity-100 translate-y-0"
                }`}
              >
                Хуралдаанд орох
              </span>
              <span
                className={`absolute inset-0 inline-flex items-center justify-center gap-2 transition-all duration-300 ${
                  loading ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"
                }`}
              >
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Бүртгэж байна...
              </span>
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        @keyframes pulse-glow-delayed {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.15);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-2px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(2px);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }

        .animate-pulse-glow-delayed {
          animation: pulse-glow-delayed 5s ease-in-out infinite;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }

        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .join-letter-modal-backdrop {
          animation: join-letter-backdrop-in 240ms ease-out forwards;
          opacity: 0;
        }

        .join-letter-modal-panel {
          animation: join-letter-panel-in 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        @keyframes join-letter-backdrop-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes join-letter-panel-in {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
