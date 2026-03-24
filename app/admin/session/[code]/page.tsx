"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QrCreator from "qr-creator";

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

type AdminMember = {
  id: string;
  fullName: string;
  joinedAt: string;
  kickedAt: string | null;
};

type ActiveDisplayPhase = "setup" | "countdown";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("mn-MN");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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
  const [deleting, setDeleting] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<null | { type: "kick"; memberId: string } | { type: "delete" }>(
    null
  );
  const [tick, setTick] = useState(0);
  const [nowISO, setNowISO] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [receiveAt, setReceiveAt] = useState<number | null>(null);
  const [activeDisplayPhase, setActiveDisplayPhase] = useState<ActiveDisplayPhase>("countdown");
  const autoClosedPollRef = useRef<string | null>(null);
  const receivePollIdRef = useRef<string | null>(null);
  const setupTimeoutRef = useRef<number | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const xAdminKey = mounted ? adminKey : "";
  const plannedFromQuery = Number.parseInt(searchParams.get("planned") ?? "", 10);

  const loadScreen = useCallback(async () => {
    const res = await fetch(`/api/session/${code}/screen`);
    if (!res.ok) return;
    const json: ScreenResponse = await res.json();
    setPollFromScreen(json.poll);
    setResults(json.results);
    setAttendance(json.attendance ?? null);
    const p = json.poll;
    if (p?.isActive) {
      if (receivePollIdRef.current !== p.id) {
        receivePollIdRef.current = p.id;
        setActiveDisplayPhase("setup");
        const audio = new Audio("/api/audio/countdown-start");
        audio.volume = 1;
        void audio.play().catch(() => {
          /* ignore autoplay block; user interaction will enable next attempt */
        });
        if (setupTimeoutRef.current != null) {
          window.clearTimeout(setupTimeoutRef.current);
        }
        setupTimeoutRef.current = window.setTimeout(() => {
          setReceiveAt(Date.now());
          setActiveDisplayPhase("countdown");
          setupTimeoutRef.current = null;
        }, 1200);
      }
    } else {
      if (setupTimeoutRef.current != null) {
        window.clearTimeout(setupTimeoutRef.current);
        setupTimeoutRef.current = null;
      }
      receivePollIdRef.current = null;
      setReceiveAt(null);
      setActiveDisplayPhase("countdown");
    }
  }, [code]);

  const loadMembers = useCallback(
    async (kind: "load" | "refresh" = "load") => {
      if (!xAdminKey) return;
      if (kind === "load") setMembersLoading(true);
      if (kind === "refresh") setRefreshingMembers(true);
      try {
        const res = await fetch(`/api/admin/sessions/${code}/members`, {
          headers: { "X-Admin-Key": xAdminKey },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setError(text || "Гишүүдийг ачаалж чадсангүй.");
          return;
        }
        const json: { members: AdminMember[] } = await res.json();
        setMembers(json.members.filter((m) => !m.kickedAt));
      } finally {
        if (kind === "load") setMembersLoading(false);
        if (kind === "refresh") setRefreshingMembers(false);
      }
    },
    [xAdminKey, code]
  );

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
      const isRefresh = e.key?.toLowerCase() === "r";
      if (!isSpace && !isRefresh) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext =
        !!target &&
        (target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select");
      if (isTypingContext) return;
      if (isSpace) {
        e.preventDefault();
        setControlsOpen((v) => !v);
      }
      if (isRefresh) {
        e.preventDefault();
        void loadScreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadScreen]);

  useEffect(() => {
    if (!pollFromScreen?.isActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt]);

  const remaining = useMemo(() => {
    if (!pollFromScreen?.isActive || activeDisplayPhase !== "countdown" || receiveAt == null) return null;
    void tick;
    return Math.max(
      0,
      (pollFromScreen.durationSeconds ?? 0) - Math.floor((Date.now() - receiveAt) / 1000)
    );
  }, [pollFromScreen?.isActive, pollFromScreen?.durationSeconds, receiveAt, tick, activeDisplayPhase]);
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
  const activePollId = pollFromScreen?.id ?? null;
  const isPollActive = pollFromScreen?.isActive === true;
  const creditsDurationSec = useMemo(() => {
    if (!results) return 24;
    const nameCount = results.approve.length + results.deny.length;
    return Math.max(12, Math.min(90, nameCount * 1.5));
  }, [results]);
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
  }, [code]);

  useEffect(() => {
    if (!showQr || !qrRef.current || !joinUrl) return;
    qrRef.current.innerHTML = "";
    QrCreator.render(
      {
        text: joinUrl,
        ecLevel: "H",
        radius: 0.2,
        fill: "#003d60",
        background: "#ffffff",
        size: 520,
      },
      qrRef.current
    );
  }, [showQr, joinUrl]);

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

  async function openMembersPanel() {
    setShowMembers(true);
    await loadMembers("load");
  }

  async function kickMember(memberId: string) {
    if (!xAdminKey) return;
    setKickingMemberId(memberId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/sessions/${code}/members/${encodeURIComponent(memberId)}/kick`,
        {
          method: "POST",
          headers: { "X-Admin-Key": xAdminKey },
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Гишүүнийг хасаж чадсангүй.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setKickingMemberId(null);
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
    if (!isPollActive) {
      autoClosedPollRef.current = null;
      return;
    }
    if (remaining == null) return;
    if (remaining > 0) return;
    if (!activePollId) return;
    if (autoClosedPollRef.current === activePollId) return;
    autoClosedPollRef.current = activePollId;
    void closePoll();
  }, [activePollId, isPollActive, remaining, closePoll]);

  async function deleteSession() {
    if (!xAdminKey) return;
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

  async function onConfirmModalApprove() {
    if (!confirmModal) return;
    const current = confirmModal;
    setConfirmModal(null);
    if (current.type === "kick") {
      await kickMember(current.memberId);
      return;
    }
    await deleteSession();
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0069a3] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute left-8 top-6 z-20 rounded-md border border-white/20 bg-[#005180]/35 px-3 py-1 text-lg font-semibold tracking-wide md:left-10 md:top-8 md:text-2xl">
        {nowISO ? formatTime(nowISO) : "--:--:--"}
      </div>
      <button
        type="button"
        onClick={copyCode}
        className="absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-md border border-white/45 bg-[#003d60]/55 px-4 py-1 text-lg font-semibold tracking-[0.2em] text-white hover:bg-[#005180]/80 md:top-8 md:text-2xl"
        title="Хуулах"
      >
        {copiedCode ? "Хуулагдлаа" : code}
      </button>
      <div className="pointer-events-none absolute right-8 top-6 z-20 rounded-md border border-white/20 bg-[#005180]/35 px-3 py-1 text-lg font-semibold tracking-wide md:right-10 md:top-8 md:text-2xl">
        {nowISO ? formatDate(nowISO) : "--/--/----"}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-md border border-white/20 bg-[#005180]/30 px-2 py-1 text-xs text-white/80 md:bottom-6 md:right-6">
        Space: самбар · R: шинэчлэх
      </div>
      {xAdminKey && controlsOpen ? (
        <div className="absolute bottom-4 left-1/2 z-30 w-[95vw] max-w-5xl -translate-x-1/2 rounded-xl border border-white/30 bg-[#003d60]/70 p-4 backdrop-blur-sm md:bottom-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/20 bg-[#005180]/35 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/85">
                Хугацаа
              </span>
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
              </div>
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
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
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
                onClick={openMembersPanel}
                className="rounded-md border border-white/50 bg-[#004f7c]/60 px-3 py-2 text-sm font-semibold text-white hover:bg-[#005f93]"
              >
                Гишүүд
              </button>
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="rounded-md border border-white/50 bg-[#004f7c]/60 px-3 py-2 text-sm font-semibold text-white hover:bg-[#005f93]"
              >
                QR код
              </button>
              <button
                type="button"
                onClick={() => setConfirmModal({ type: "delete" })}
                disabled={deleting}
                className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/60 disabled:opacity-60"
              >
                {deleting ? "…" : "Хуралдаан устгах"}
              </button>
            </div>
          </div>
          {error ? <div className="mt-2 text-sm text-amber-200">{error}</div> : null}
        </div>
      ) : null}
      {showQr ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#003d60]/80 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowQr(false)}
            className="absolute right-4 top-4 rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d] md:right-6 md:top-6"
          >
            Хаах
          </button>
          <div className="rounded-2xl bg-white p-5 shadow-2xl">
            <div ref={qrRef} className="h-[520px] w-[520px]" />
          </div>
        </div>
      ) : null}
      {showMembers ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#003d60]/80 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setShowMembers(false)}
            className="absolute right-4 top-4 rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d] md:right-6 md:top-6"
          >
            Хаах
          </button>
          <div className="w-full max-w-3xl rounded-2xl border border-white/30 bg-[#0069a3] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Хурлын гишүүд</h3>
              <button
                type="button"
                onClick={() => void loadMembers("refresh")}
                disabled={refreshingMembers}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/55 bg-[#005180]/70 text-white hover:bg-[#00659d] disabled:opacity-60"
                title="Шинэчлэх"
                aria-label="Шинэчлэх"
              >
                <svg viewBox="0 0 24 24" className={["h-5 w-5", refreshingMembers ? "animate-spin" : ""].join(" ")} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 10-3.2 6.9" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>

            <div className="max-h-[65vh] space-y-2 overflow-auto pr-1">
              {membersLoading ? (
                <div className="rounded-md border border-white/20 bg-[#005180]/45 px-3 py-3 text-sm text-white/90">
                  Ачаалж байна…
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-md border border-white/20 bg-[#005180]/45 px-3 py-3 text-sm text-white/90">
                  Бүртгэгдсэн гишүүн алга.
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-white/25 bg-[#005180]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">{m.fullName}</div>
                      <div className="text-xs text-white/75">{m.kickedAt ? "Хасагдсан" : "Идэвхтэй"}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!!m.kickedAt || kickingMemberId === m.id}
                      onClick={() => setConfirmModal({ type: "kick", memberId: m.id })}
                      className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900/60 disabled:opacity-60"
                    >
                      {kickingMemberId === m.id ? "…" : "Хасах"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
      {confirmModal ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#003d60]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/30 bg-[#0069a3] p-5 shadow-2xl">
            <h4 className="text-lg font-semibold text-white">Баталгаажуулалт</h4>
            <p className="mt-2 text-sm text-white/90">
              {confirmModal.type === "delete"
                ? "Энэ хуралдааныг бүрэн устгах уу? Буцаах боломжгүй."
                : "Энэ гишүүнийг хуралдаанаас хасах уу?"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-md border border-white/55 bg-[#005180]/70 px-3 py-2 text-sm font-semibold text-white hover:bg-[#00659d]"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={() => void onConfirmModalApprove()}
                className="rounded-md border border-red-300/70 bg-red-900/45 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-900/60"
              >
                Тийм
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!pollFromScreen ? (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div>
            <p className="text-4xl font-semibold md:text-6xl">ИРЦ {currentAttendance}/{plannedAttendance}</p>
            <p className="mt-2 text-2xl font-semibold text-white/85 md:text-4xl">{attendancePercent.toFixed(1)}%</p>
          </div>
        </div>
      ) : pollFromScreen.isActive ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          {activeDisplayPhase === "setup" ? (
            <div>
              <div className="text-4xl font-semibold tracking-wide text-white md:text-6xl">БЭЛДЭЖ БАЙНА...</div>
              <div className="mt-4 text-xl text-white/85 md:text-3xl">ИРЦ {currentAttendance}/{plannedAttendance}</div>
            </div>
          ) : (
            <>
              <div className="mb-6 text-3xl font-semibold tracking-wide text-white md:text-5xl">
                Ирц {currentAttendance}/{plannedAttendance} {attendancePercent.toFixed(1)}%
              </div>
              <div className="font-mono text-[10rem] font-bold leading-none tabular-nums text-[#fde047] md:text-[16rem]">
                {remaining ?? 0}
              </div>
              <div className="mt-6 rounded-md border border-white/20 bg-[#005180]/30 px-4 py-2 text-sm text-white/90">
                Санал өгсөн: {attendance?.votesCastCount ?? 0}
              </div>
            </>
          )}
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
                className="screen-credits-track h-full pr-1 text-left"
                style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
              >
                {results.approve.length === 0 ? (
                  <div className="pt-8 text-center text-3xl text-white/80 md:text-4xl">—</div>
                ) : (
                  results.approve.map((v) => (
                    <div key={v.memberId} className="mb-3 text-left text-2xl font-semibold md:text-4xl">
                      {v.fullName}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="h-full overflow-hidden px-4 py-4 md:px-6">
              <div
                className="screen-credits-track h-full pr-1 text-left"
                style={{ animationDuration: `${creditsDurationSec}s`, animationIterationCount: "infinite" }}
              >
                {results.deny.length === 0 ? (
                  <div className="pt-8 text-center text-3xl text-[#fde047] md:text-4xl">—</div>
                ) : (
                  results.deny.map((v) => (
                    <div key={v.memberId} className="mb-3 text-left text-2xl font-semibold text-[#fde047] md:text-4xl">
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
