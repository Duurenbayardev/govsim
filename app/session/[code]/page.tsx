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
      router.push("/join");
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
      router.push("/join");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8">
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#c9a227]/20 pb-6">
        <div>
          <p className="gov-label text-[#d4bc6a]">Гишүүний санал</p>
          <h1 className="gov-section-title mt-1 text-2xl font-semibold text-[#e8f4fc] md:text-3xl">
            Хуралдаан {code}
          </h1>
          <p className="mt-1 text-sm text-[#8ab4d8]">
            {memberName ? (
              <>
                Бүртгэгдсэн гишүүн: <span className="font-medium text-[#c8dff0]">{memberName}</span>
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
            className="gov-btn-outline-light rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {leaving ? "…" : "Хуралдаанаас гарах"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!token ? (
        <div className="gov-panel mt-6 p-6">
          <p className="text-sm text-[#b8d4f0]">Энэ төхөөрөмжид хүчинтэй хуралдааны мэдээлэл алга.</p>
          <button
            type="button"
            onClick={() => router.push("/join")}
            className="gov-btn-primary mt-4 w-full rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            Гишүүний нэвтрэлт рүү буцах
          </button>
        </div>
      ) : null}

      {token ? (
        <div className="gov-panel mt-6 space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => castVote("approve")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
                pollActive
                  ? "border-[#3aa7ff] bg-[#1e88d3] text-white hover:bg-[#2b95df]"
                  : "border-[#2f7fb2] bg-[#0f5d91] text-white hover:bg-[#1271b0]",
              ].join(" ")}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              ) : null}
              Зөвшөөрөх
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => castVote("deny")}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
                pollActive
                  ? "border-[#facc15] bg-[#b08900] text-[#fff4cc] hover:bg-[#c89a00]"
                  : "border-[#d4b038] bg-[#9d7b00] text-[#fff4cc] hover:bg-[#b08900]",
              ].join(" ")}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#fff4cc]/35 border-t-[#fff4cc]" />
              ) : null}
              Татгалзах
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
