"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PollResponse = {
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    isActive: boolean;
    status: "open" | "closed";
  } | null;
  myVote: "approve" | "deny" | null;
  member: { fullName: string } | null;
};

export default function SessionPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = params.code;
  const [token, setToken] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);

  const [data, setData] = useState<PollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [showVoteToast, setShowVoteToast] = useState(false);
  const [ready, setReady] = useState(false);

  const pollActive = data?.poll?.isActive === true;

  function triggerVoteToast(text: "Амжилттай" | "Амжилтгүй") {
    setVoteStatus(text);
    setShowVoteToast(true);
    window.setTimeout(() => setShowVoteToast(false), 1500);
    window.setTimeout(() => setVoteStatus(null), 2100);
  }

  useEffect(() => {
    const t = localStorage.getItem("govsim_member_token");
    const storedCode = localStorage.getItem("govsim_member_session_code");
    const storedName = localStorage.getItem("govsim_member_full_name");
    if (!t || !storedCode || storedCode !== code) {
      setToken(null);
      setMemberName(null);
      return;
    }
    setToken(t);
    setMemberName(storedName);
    setReady(true);
  }, [code]);

  /** Initial load only — no polling, no refresh */
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(`/api/session/${code}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setError(text || "Санал ачаалж чадсангүй.");
          return;
        }

        const json: PollResponse = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      }
    })();
  }, [token, code]);

  async function castVote(choice: "approve" | "deny") {
    if (!token) return;

    setLoading(true);
    setError(null);
    setVoteStatus(null);
    setShowVoteToast(false);
    try {
      const res = await fetch(`/api/session/${code}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ choice }),
      });

      if (!res.ok) {
        triggerVoteToast("Амжилтгүй");
        return;
      }

      await res.json().catch(() => null);
      triggerVoteToast("Амжилттай");
      setData((prev) =>
        prev
          ? {
              ...prev,
              myVote: choice,
              poll: prev.poll ? { ...prev.poll, isActive: true } : prev.poll,
            }
          : prev
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      triggerVoteToast("Амжилтгүй");
    } finally {
      setLoading(false);
    }
  }

  function clearMemberStorage() {
    localStorage.removeItem("govsim_member_token");
    localStorage.removeItem("govsim_member_session_code");
    localStorage.removeItem("govsim_member_id");
    localStorage.removeItem("govsim_member_full_name");
  }

  /** Removes your member record on the server, then clears this device */
  async function leaveSession() {
    if (!token) {
      clearMemberStorage();
      router.push("/");
      return;
    }
    const ok = window.confirm(
      "Энэ хуралдаанаас гарах уу? Ижил код, нэрээр дахин нэгдэж болно."
    );
    if (!ok) return;
    setLeaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/session/${code}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдаанаас гарч чадсангүй.");
        return;
      }
      clearMemberStorage();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8">
      {voteStatus ? (
        <div
          className={[
            "pointer-events-none fixed right-4 top-1/2 z-50 -translate-y-1/2 rounded-l-lg border px-5 py-3 text-sm font-semibold shadow-xl transition-all duration-500",
            showVoteToast ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0",
            voteStatus === "Амжилттай"
              ? "border-emerald-400/55 bg-emerald-900/90 text-emerald-100"
              : "border-red-400/55 bg-red-900/90 text-red-100",
          ].join(" ")}
        >
          {voteStatus}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/30 bg-[#0077b8]/55 p-5 shadow-[0_14px_36px_rgba(0,38,62,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/25 pb-4">
          <div>
            <p className="gov-label text-white/80">Хурлын гишүүн</p>
            <h1 className="gov-section-title mt-1 text-2xl font-semibold text-white md:text-3xl">
              Хуралдаан {code}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {memberName ? (
                <>
                  Бүртгэгдсэн гишүүн: <span className="font-medium text-white">{memberName}</span>
                </>
              ) : (
                "Санал өгөхийн тулд гишүүний нэвтрэлтээр орно уу."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={leaveSession}
              disabled={leaving}
              className="rounded-lg border border-white/55 bg-[#005180]/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00659d] disabled:opacity-60"
            >
              {leaving ? "…" : "Хуралдаанаас гарах"}
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-400/45 bg-red-900/35 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </div>

      {!token ? (
        <div className="mt-6 rounded-2xl border border-white/30 bg-[#0077b8]/55 p-6 backdrop-blur-sm shadow-[0_14px_36px_rgba(0,38,62,0.28)]">
          <p className="text-sm text-[#b8d4f0]">
            {ready ? "Энэ төхөөрөмжид хүчинтэй хуралдааны мэдээлэл алга." : "Ачаалж байна…"}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="gov-btn-primary mt-4 w-full rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            Нүүр хуудас руу буцах
          </button>
        </div>
      ) : null}

      {token ? (
        <div className="mt-6 rounded-2xl border border-white/30 bg-[#0077b8]/55 p-4 backdrop-blur-sm shadow-[0_14px_36px_rgba(0,38,62,0.28)]">
          {pollActive ? (
            <div className="rounded-md border border-white/25 bg-[#0069a3]/55 px-3 py-2 text-sm text-white/95">
              Санал нээлттэй — аль нэг товчийг дарна уу.
            </div>
          ) : null}
          <div className="grid h-[calc(100dvh-320px)] min-h-[240px] grid-cols-2 gap-3 md:h-[calc(100dvh-300px)] md:min-h-[340px] md:gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => castVote("approve")}
              className={[
                "inline-flex h-full flex-col items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center text-lg font-bold leading-tight transition disabled:cursor-not-allowed disabled:opacity-70 sm:px-3 sm:py-3 sm:text-xl md:gap-3 md:px-4 md:text-4xl",
                pollActive
                  ? "border-[#67c0ff] bg-[#1f8fda] text-white hover:bg-[#2ca0ee]"
                  : "border-[#2f7fb2] bg-[#0f5d91] text-white/95 hover:bg-[#1271b0]",
              ].join(" ")}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              ) : null}
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 shrink-0 sm:h-7 sm:w-7 md:h-10 md:w-10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M20 7L9 18l-5-5" />
              </svg>
              <span className="max-w-full break-words">Зөвшөөрөх</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => castVote("deny")}
              className={[
                "inline-flex h-full flex-col items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center text-lg font-bold leading-tight transition disabled:cursor-not-allowed disabled:opacity-70 sm:px-3 sm:py-3 sm:text-xl md:gap-3 md:px-4 md:text-4xl",
                pollActive
                  ? "border-[#f7de72] bg-[#b48a00] text-[#fff4cc] hover:bg-[#c59900]"
                  : "border-[#d4b038] bg-[#9d7b00] text-[#fff4cc] hover:bg-[#b08900]",
              ].join(" ")}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#fff4cc]/35 border-t-[#fff4cc]" />
              ) : null}
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 shrink-0 sm:h-7 sm:w-7 md:h-10 md:w-10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <span className="max-w-full break-words">Татгалзах</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
