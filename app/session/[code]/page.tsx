"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function msToSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function SessionPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = params.code;
  const [token, setToken] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);

  const [data, setData] = useState<PollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Re-render every second for countdown display (no HTTP) */
  const [tick, setTick] = useState(0);

  const myVote = data?.myVote ?? null;
  const poll = data?.poll ?? null;

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

  const fetchMe = useCallback(async () => {
    if (!token) return;
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
  }, [token, code]);

  /** Initial load only — no polling */
  useEffect(() => {
    if (!token) return;
    void fetchMe();
  }, [token, code, fetchMe]);

  /** Local 1s tick while poll is active so countdown updates without extra requests */
  useEffect(() => {
    if (!poll?.isActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [poll?.isActive, poll?.endsAt]);

  const remainingSeconds = useMemo(() => {
    if (!poll?.isActive) return null;
    void tick; // recompute every second for live countdown (no extra HTTP)
    return msToSeconds(new Date(poll.endsAt).getTime() - Date.now());
  }, [poll?.isActive, poll?.endsAt, tick]);

  async function onRefreshClick() {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    await fetchMe();
    setRefreshing(false);
  }

  async function castVote(choice: "approve" | "deny") {
    if (!token) return;
    if (!poll) return;
    if (!poll.isActive) return;
    if (myVote) return;

    setLoading(true);
    setError(null);
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
        const text = await res.text().catch(() => "");
        setError(text || "Санал өгч чадсангүй.");
        return;
      }

      const json: { myVote: "approve" | "deny" } = await res.json();
      setData((prev) => (prev ? { ...prev, myVote: json.myVote } : prev));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
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
          {token ? (
            <button
              type="button"
              onClick={onRefreshClick}
              disabled={refreshing}
              className="rounded-md border border-[#2a5a8a]/55 bg-[#071a2e]/70 px-3 py-2 text-sm font-semibold text-[#c8dff0] shadow-sm hover:bg-[#0a2740] disabled:opacity-60"
            >
              {refreshing ? "…" : "Шинэчлэх"}
            </button>
          ) : null}
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

      {token && poll ? (
        <div className="gov-panel mt-6 space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[240px]">
              <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Нийтэлсэн асуулт</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#b8d4f0]">{poll.problem}</p>
            </div>

            <div className="rounded-md border border-[#2a5a8a]/45 bg-[#071a2e]/60 px-3 py-2 text-sm text-[#c8dff0]">
              <div className="gov-label">{poll.isActive ? "Үлдсэн хугацаа" : "Төлөв"}</div>
              <div className="mt-1 font-mono font-semibold tabular-nums">
                {poll.isActive ? `${remainingSeconds ?? 0} сек` : "Хаагдсан"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!poll.isActive || !!myVote || loading}
              onClick={() => castVote("approve")}
              className={[
                "rounded-md px-4 py-3 text-base font-semibold transition",
                poll.isActive && !myVote
                  ? "gov-btn-primary"
                  : "border border-[#2a5a8a]/40 bg-[#071a2e]/50 text-[#6b9cc4]",
                myVote === "approve" ? "ring-2 ring-[#17649b] ring-offset-2 ring-offset-[#0a2740]" : "",
              ].join(" ")}
            >
              Зөвшөөрөх
            </button>
            <button
              type="button"
              disabled={!poll.isActive || !!myVote || loading}
              onClick={() => castVote("deny")}
              className={[
                "rounded-md px-4 py-3 text-base font-semibold transition",
                poll.isActive && !myVote
                  ? "border border-[#2a5a8a]/70 bg-[#0d3558] text-[#e8f4fc] hover:bg-[#123a5c]"
                  : "border border-[#2a5a8a]/40 bg-[#071a2e]/50 text-[#6b9cc4]",
                myVote === "deny" ? "ring-2 ring-[#17649b] ring-offset-2 ring-offset-[#0a2740]" : "",
              ].join(" ")}
            >
              Татгалзах
            </button>
          </div>

          {myVote ? (
            <p className="text-sm text-[#8ab4d8]">
              Санал бүртгэгдлээ:{" "}
              <span className="font-semibold text-[#c8dff0]">
                {myVote === "approve" ? "Зөвшөөрөх" : "Татгалзах"}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {token && !poll ? (
        <div className="gov-panel mt-6 p-6">
          <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Нийтэлсэн санал алга</h2>
          <p className="mt-2 text-sm text-[#8ab4d8]">
            Дарга асуултыг нэээгүй байна. Санал зарласны дараа{" "}
            <span className="font-semibold text-[#c8dff0]">Шинэчлэх</span> товчийг дарна уу.
          </p>
        </div>
      ) : null}
    </div>
  );
}
