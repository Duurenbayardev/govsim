"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScreenResponse = {
  sessionCode: string;
  nowISO: string;
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    closedAt: string | null;
    status: "open" | "closed";
    isActive: boolean;
  } | null;
  results: null | {
    totalVotes: number;
    approveCount: number;
    denyCount: number;
    approvePercent: number;
    denyPercent: number;
    approve: Array<{ memberId: string; fullName: string }>;
    deny: Array<{ memberId: string; fullName: string }>;
  };
  attendance?: {
    eligibleMemberCount: number;
    plannedAttendeeCount?: number;
    votesCastCount: number;
    voteParticipationPercent: number;
  };
};

function msToSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("mn-MN");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminSessionPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = params.code;
  const adminKey = searchParams.get("key") ?? "";

  const [pollFromScreen, setPollFromScreen] = useState<ScreenResponse["poll"]>(null);
  const [results, setResults] = useState<ScreenResponse["results"]>(null);
  const [attendance, setAttendance] = useState<ScreenResponse["attendance"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationPreset, setDurationPreset] = useState<"10" | "15" | "25" | "custom">("10");
  const [customDuration, setCustomDuration] = useState("30");
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [tick, setTick] = useState(0);
  const [nowISO, setNowISO] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const autoClosedPollRef = useRef<string | null>(null);
  const playedStartAudioForPollRef = useRef<string | null>(null);

  const xAdminKey = mounted ? adminKey : "";
  const plannedFromQuery = Number.parseInt(searchParams.get("planned") ?? "", 10);

  const loadScreen = useCallback(async () => {
    const res = await fetch(`/api/session/${code}/screen`);
    if (!res.ok) return;
    const json: ScreenResponse = await res.json();
    setPollFromScreen(json.poll);
    setResults(json.results);
    setAttendance(json.attendance ?? null);
  }, [code]);

  const refreshAll = useCallback(async () => {
    if (!xAdminKey) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadScreen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setRefreshing(false);
    }
  }, [xAdminKey, loadScreen]);

  useEffect(() => {
    if (!xAdminKey) return;
    void (async () => {
      try {
        await loadScreen();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      }
    })();
  }, [xAdminKey, code, loadScreen]);

  useEffect(() => {
    setNowISO(new Date().toISOString());
    const id = window.setInterval(() => {
      setNowISO(new Date().toISOString());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar";
      if (!isSpace) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext =
        !!target &&
        (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
      if (isTypingContext) return;
      e.preventDefault();
      setControlsOpen((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!pollFromScreen?.isActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt]);

  useEffect(() => {
    if (!pollFromScreen?.isActive || !pollFromScreen.id) {
      playedStartAudioForPollRef.current = null;
      return;
    }
    if (playedStartAudioForPollRef.current === pollFromScreen.id) return;
    playedStartAudioForPollRef.current = pollFromScreen.id;
    const audio = new Audio("/api/audio/countdown-start");
    audio.volume = 1;
    void audio.play().catch(() => {
      /* ignore autoplay block; user interaction will enable next attempt */
    });
  }, [pollFromScreen?.id, pollFromScreen?.isActive]);

  const remaining = useMemo(() => {
    if (!pollFromScreen?.isActive) return null;
    void tick;
    return msToSeconds(new Date(pollFromScreen.endsAt).getTime() - Date.now());
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt, tick]);
  const currentAttendance = attendance?.eligibleMemberCount ?? 0;
  const plannedAttendanceRaw = attendance?.plannedAttendeeCount ?? 0;
  const plannedAttendance =
    plannedAttendanceRaw > 0
      ? plannedAttendanceRaw
      : Number.isFinite(plannedFromQuery) && plannedFromQuery > 0
        ? plannedFromQuery
        : Math.max(currentAttendance, 1);
  const attendancePercent =
    plannedAttendance > 0 ? Math.round((currentAttendance / plannedAttendance) * 1000) / 10 : 0;
  const creditsDurationSec = useMemo(() => {
    if (!results) return 24;
    const nameCount = results.approve.length + results.deny.length;
    return Math.max(12, Math.min(90, nameCount * 1.5));
  }, [results]);

  function resolveDurationSeconds(): number {
    if (durationPreset === "custom") {
      const n = parseInt(customDuration, 10);
      return Math.min(600, Math.max(5, Number.isNaN(n) ? 10 : n));
    }
    return parseInt(durationPreset, 10);
  }

  async function startPoll() {
    if (!xAdminKey) return;
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${code}/poll/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": xAdminKey,
        },
        body: JSON.stringify({ durationSeconds: resolveDurationSeconds() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Санал эхлүүлж чадсангүй.");
        return;
      }
      const json: { pollId: string; durationSeconds: number } = await res.json();
      setError(`Санал эхэллээ (${json.pollId}, ${json.durationSeconds} сек).`);
      await loadScreen();
      setControlsOpen(false);
    } finally {
      setStarting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1200);
    } catch {
      setError("Код хуулж чадсангүй.");
    }
  }

  const closePoll = useCallback(async () => {
    if (!xAdminKey) return;
    setError(null);
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/sessions/${code}/poll/close`, {
        method: "POST",
        headers: { "X-Admin-Key": xAdminKey },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Саналыг хааж чадсангүй.");
        return;
      }
      setError("Санал хаагдлаа.");
      await loadScreen();
    } finally {
      setClosing(false);
    }
  }, [xAdminKey, code, loadScreen]);

  useEffect(() => {
    if (!pollFromScreen?.isActive) {
      autoClosedPollRef.current = null;
      return;
    }
    if ((remaining ?? 0) > 0) return;
    if (autoClosedPollRef.current === pollFromScreen.id) return;
    autoClosedPollRef.current = pollFromScreen.id;
    void closePoll();
  }, [pollFromScreen?.id, pollFromScreen?.isActive, remaining, closePoll]);

  async function deleteSession() {
    if (!xAdminKey) return;
    const ok = window.confirm(
      "Энэ хуралдааныг бүрэн устгах уу? Бүх гишүүн, санал хураалт, санал устана. Буцаах боломжгүй."
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${code}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": xAdminKey },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Хуралдааныг устгаж чадсангүй.");
        return;
      }
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0069a3] text-white">
      <div className="pointer-events-none absolute left-8 top-6 z-20 text-lg font-semibold tracking-wide md:left-10 md:top-8 md:text-2xl">
        {nowISO ? formatTime(nowISO) : "--:--:--"}
      </div>
      <button
        type="button"
        onClick={copyCode}
        className="absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-md border border-white/45 bg-[#003d60]/45 px-3 py-1 text-lg font-semibold tracking-[0.2em] text-white hover:bg-[#005180]/70 md:top-8 md:text-2xl"
        title="Хуулах"
      >
        {copiedCode ? "Хуулагдлаа" : code}
      </button>
      <div className="pointer-events-none absolute right-8 top-6 z-20 text-lg font-semibold tracking-wide md:right-10 md:top-8 md:text-2xl">
        {nowISO ? formatDate(nowISO) : "--/--/----"}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 text-xs text-white/75 md:bottom-6 md:right-6">
        Space: самбар
      </div>
      {xAdminKey && controlsOpen ? (
        <div className="absolute bottom-4 left-1/2 z-30 w-[95vw] max-w-5xl -translate-x-1/2 rounded-xl border border-white/30 bg-[#003d60]/65 px-4 py-3 backdrop-blur-sm md:bottom-6">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            <span className="text-sm text-white/85">Хугацаа:</span>
            <div className="flex flex-wrap gap-2">
              {(["10", "15", "25"] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!!pollFromScreen?.isActive}
                  onClick={() => {
                    setDurationPreset(sec);
                  }}
                  className={[
                    "rounded-md border px-3 py-1.5 text-sm font-semibold text-white",
                    durationPreset === sec
                      ? "border-white bg-white/30"
                      : "border-white/45 bg-[#004f7c]/60 hover:bg-[#005f93]",
                  ].join(" ")}
                >
                  {sec} сек
                </button>
              ))}
              <button
                type="button"
                disabled={!!pollFromScreen?.isActive}
                onClick={() => setDurationPreset("custom")}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm font-semibold text-white",
                  durationPreset === "custom"
                    ? "border-white bg-white/30"
                    : "border-white/45 bg-[#004f7c]/60 hover:bg-[#005f93]",
                ].join(" ")}
              >
                Өөрөө
              </button>
            </div>{" "}
            {durationPreset === "custom" ? (
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-white/80">5-600</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  className="w-24 rounded-md border border-white/45 bg-[#004f7c]/60 px-2 py-1 text-sm text-white outline-none"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                />
              </label>
            ) : null}
            <button
              type="button"
              disabled={!xAdminKey || starting || !!pollFromScreen?.isActive}
              onClick={startPoll}
              className="rounded-md border border-white/60 bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 disabled:opacity-60"
            >
              {starting ? "Нийтэлж байна…" : "Санал эхлүүлэх"}
            </button>
            <button
              type="button"
              disabled={!xAdminKey || closing || !pollFromScreen || !pollFromScreen.isActive}
              onClick={closePoll}
              className="rounded-md border border-white/60 bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 disabled:opacity-60"
            >
              {closing ? "Хааж байна…" : "Санал хаах"}
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="rounded-md border border-white/50 bg-[#004f7c]/60 px-3 py-2 text-sm font-semibold text-white hover:bg-[#005f93] disabled:opacity-60"
            >
              {refreshing ? "…" : "Шинэчлэх"}
            </button>
            <button
              type="button"
              onClick={deleteSession}
              disabled={deleting}
              className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/60 disabled:opacity-60"
            >
              {deleting ? "…" : "Хуралдаан устгах"}
            </button>
            {error ? <span className="text-sm text-amber-200">{error}</span> : null}
          </div>
        </div>
      ) : null}

      {!pollFromScreen ? (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <p className="text-3xl font-semibold md:text-5xl">Санал эхлээгүй</p>
        </div>
      ) : pollFromScreen.isActive ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 text-3xl font-semibold tracking-wide text-white md:text-5xl">
            Ирц {currentAttendance}/{plannedAttendance} {attendancePercent.toFixed(1)}%
          </div>
          <div className="font-mono text-[10rem] font-bold leading-none tabular-nums text-[#fde047] md:text-[16rem]">
            {remaining ?? 0}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-sm text-white/85">
            <div>Ирц: {attendance?.eligibleMemberCount ?? 0}</div>
            <div>Санал: {attendance?.votesCastCount ?? 0}</div>
          </div>
        </div>
      ) : results ? (
        <div className="min-h-screen px-6 pb-10 pt-32 md:px-10 md:pt-36">
          <div className="pointer-events-none absolute left-6 top-24 w-[44%] text-center md:left-10 md:top-28">
            <div className="text-3xl font-bold uppercase md:text-5xl">Зөвшөөрсөн</div>
            <div className="mt-2 text-lg font-semibold md:text-2xl">
              {results.approveCount}/{attendance?.eligibleMemberCount ?? results.totalVotes}{" "}
              {results.approvePercent.toFixed(1)}%
            </div>
          </div>
          <div className="pointer-events-none absolute right-6 top-24 w-[44%] text-center md:right-10 md:top-28">
            <div className="text-3xl font-bold uppercase text-[#fde047] md:text-5xl">Татгалзсан</div>
            <div className="mt-2 text-lg font-semibold text-[#fde047] md:text-2xl">
              {results.denyCount}/{attendance?.eligibleMemberCount ?? results.totalVotes}{" "}
              {results.denyPercent.toFixed(1)}%
            </div>
          </div>

          <div className="grid min-h-[70vh] grid-cols-2 gap-8 pt-10 md:gap-14">
            <div className="h-full overflow-hidden px-4 py-4 md:px-6">
              <div
                className="screen-credits-track h-full pr-1"
                style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
              >
                {results.approve.length === 0 ? (
                  <div className="pt-8 text-center text-3xl text-white/80 md:text-4xl">—</div>
                ) : (
                  results.approve.map((v) => (
                    <div key={v.memberId} className="mb-3 text-center text-2xl font-semibold md:text-4xl">
                      {v.fullName}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="h-full overflow-hidden px-4 py-4 md:px-6">
              <div
                className="screen-credits-track h-full pr-1"
                style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
              >
                {results.deny.length === 0 ? (
                  <div className="pt-8 text-center text-3xl text-[#fde047] md:text-4xl">—</div>
                ) : (
                  results.deny.map((v) => (
                    <div key={v.memberId} className="mb-3 text-center text-2xl font-semibold text-[#fde047] md:text-4xl">
                      {v.fullName}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <p className="text-3xl font-semibold md:text-5xl">Санал хаагдсан</p>
        </div>
      )}
    </div>
  );
}
