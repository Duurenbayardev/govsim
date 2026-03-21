"use client";

import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  attendance: {
    eligibleMemberCount: number;
    votesCastCount: number;
    voteParticipationPercent: number;
  };
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("mn-MN");
}

const IDLE_MS = 5000;
const COUNTDOWN_MS = 1000;

/** Pixels of vertical travel per second for the credit roll (tunes how fast names move). */
const CREDITS_PX_PER_SEC = 88;
const CREDITS_MAX_SEC = 180;

/** Short roll for few names; floor rises with headcount so long lists stay readable. */
function creditsFloorSeconds(nameCount: number) {
  return Math.max(2, Math.min(16, 2 + nameCount * 0.35));
}

type PostPollPhase = "hidden" | "credits" | "summary";

function creditsStorageKey(sessionCode: string, pollId: string) {
  return `govsim-screen-credits:${sessionCode}:${pollId}`;
}

function hasSeenCredits(sessionCode: string, pollId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(creditsStorageKey(sessionCode, pollId)) === "1";
  } catch {
    return false;
  }
}

function markCreditsSeen(sessionCode: string, pollId: string) {
  try {
    sessionStorage.setItem(creditsStorageKey(sessionCode, pollId), "1");
  } catch {
    /* ignore */
  }
}

export default function ScreenPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [data, setData] = useState<ScreenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /** When this client first received the active poll payload — full window counts from here */
  const [receiveAt, setReceiveAt] = useState<number | null>(null);
  /** Which poll id receiveAt refers to (set in fetch handler, same tick as JSON) */
  const receivePollIdRef = useRef<string | null>(null);

  const [postPollPhase, setPostPollPhase] = useState<PostPollPhase>("hidden");
  const creditsPollIdRef = useRef<string | null>(null);
  /** Set after layout measure so the CSS animation runs once with the correct duration */
  const [creditsRollDurationSec, setCreditsRollDurationSec] = useState<number | null>(null);
  const creditsTrackRef = useRef<HTMLDivElement | null>(null);
  const creditsDoneRef = useRef(false);

  const pollActiveForFetch = !loading && data?.poll?.isActive === true;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/session/${code}/screen`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (!cancelled) setError(text || "Дэлгэцийг ачаалж чадсангүй.");
          return;
        }
        const json: ScreenResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
          const p = json.poll;
          if (p?.isActive) {
            if (receivePollIdRef.current !== p.id) {
              receivePollIdRef.current = p.id;
              setReceiveAt(Date.now());
            }
          } else {
            receivePollIdRef.current = null;
            setReceiveAt(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const ms = pollActiveForFetch ? COUNTDOWN_MS : IDLE_MS;
    const id = window.setInterval(() => {
      void load();
    }, ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [code, pollActiveForFetch]);

  /** Local 1s tick only while countdown is shown (after poll received) */
  useEffect(() => {
    if (loading || !data?.poll?.isActive || receiveAt == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading, data?.poll?.isActive, receiveAt]);

  const poll = data?.poll ?? null;
  const results = data?.results ?? null;
  const attendance = data?.attendance ?? null;

  /** After poll closes: credit roll first (unless already seen this poll), then summary. */
  useLayoutEffect(() => {
    if (!poll || poll.isActive || !results) {
      setPostPollPhase("hidden");
      setCreditsRollDurationSec(null);
      creditsPollIdRef.current = null;
      creditsDoneRef.current = false;
      return;
    }

    if (hasSeenCredits(code, poll.id)) {
      creditsPollIdRef.current = poll.id;
      setPostPollPhase("summary");
      setCreditsRollDurationSec(null);
      return;
    }

    if (creditsPollIdRef.current !== poll.id) {
      creditsPollIdRef.current = poll.id;
      creditsDoneRef.current = false;
      setPostPollPhase("credits");
      setCreditsRollDurationSec(null);
    }
  }, [code, poll, results]);

  /** Measure credit roll height, then start one CSS animation with matching duration. */
  useLayoutEffect(() => {
    if (postPollPhase !== "credits" || !results) {
      setCreditsRollDurationSec(null);
      return;
    }
    const el = creditsTrackRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setCreditsRollDurationSec(0.001);
      return;
    }

    const nameCount = results.approve.length + results.deny.length;
    const floorSec = creditsFloorSeconds(nameCount);
    const h = el.scrollHeight;
    const vh = window.innerHeight;
    const distance = h + vh;
    const scrollSec = distance / CREDITS_PX_PER_SEC;
    const sec = Math.min(CREDITS_MAX_SEC, Math.max(floorSec, scrollSec));
    setCreditsRollDurationSec(sec);
  }, [postPollPhase, results]);

  const onCreditsComplete = useCallback(() => {
    if (creditsDoneRef.current) return;
    creditsDoneRef.current = true;
    if (poll?.id) {
      markCreditsSeen(code, poll.id);
    }
    setPostPollPhase("summary");
    setCreditsRollDurationSec(null);
  }, [code, poll?.id]);

  const remainingSeconds = useMemo(() => {
    if (!poll?.isActive || receiveAt == null || !poll.durationSeconds) return null;
    void tick;
    /** Full published window from first moment this display received the poll — not clamped to server clock */
    return Math.max(
      0,
      poll.durationSeconds - Math.floor((Date.now() - receiveAt) / 1000)
    );
  }, [poll?.isActive, poll?.durationSeconds, receiveAt, tick]);

  const showClosedSummary =
    poll && !poll.isActive && results && postPollPhase === "summary";

  const showCreditsOverlay =
    poll && !poll.isActive && results && postPollPhase === "credits";

  return (
    <div className="gov-app-bg min-h-screen text-[#c8dff0]">
      {/* Full-screen credit roll after voting ends */}
      {showCreditsOverlay && results ? (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[linear-gradient(180deg,#0b1f34_0%,#0e2a47_52%,#113656_100%)] shadow-[inset_0_1px_0_0_rgba(201,162,39,0.22)]"
          aria-live="polite"
          aria-label="Санал хураалтын үр дүн — нэрсийн жагсаалт"
        >
          <div className="shrink-0 border-b border-[#c9a227]/18 bg-[#071a2e]/35 px-6 py-5 text-center backdrop-blur-[2px]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c9a227]/75">
              Санал хураалт дууссан · Албан ёсны дүн
            </div>
            <div className="font-serif mt-2.5 text-xl font-semibold leading-snug text-[#e8f0f8] md:text-2xl">
              {poll.problem}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={creditsTrackRef}
              className={`flex w-full items-start justify-between gap-12 px-6 pb-24 pt-10 sm:gap-16 sm:px-12 md:gap-24 md:px-16 lg:gap-32 lg:px-24 xl:gap-40 xl:px-32 2xl:px-40 ${
                creditsRollDurationSec != null ? "screen-credits-track" : ""
              }`}
              style={
                creditsRollDurationSec != null
                  ? { animationDuration: `${creditsRollDurationSec}s` }
                  : undefined
              }
              onAnimationEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.animationName !== "screen-credits-roll") return;
                onCreditsComplete();
              }}
            >
              <div className="flex min-h-0 w-[42%] min-w-0 max-w-xl flex-col items-end text-right xl:max-w-2xl">
                <div className="mb-8 text-base font-semibold uppercase tracking-[0.2em] text-[#dce6f2]/92 md:text-xl">
                  Зөвшөөрсөн
                </div>
                {results.approve.length === 0 ? (
                  <div className="text-3xl text-[#dce6f2]/35 md:text-4xl">—</div>
                ) : (
                  results.approve.map((v) => (
                    <div
                      key={v.memberId}
                      className="mb-6 max-w-full text-3xl font-semibold leading-tight text-[#eef3f9] md:text-4xl lg:text-5xl"
                    >
                      {v.fullName}
                    </div>
                  ))
                )}
              </div>

              <div className="flex min-h-0 w-[42%] min-w-0 max-w-xl flex-col items-start xl:max-w-2xl">
                <div className="mb-8 text-base font-semibold uppercase tracking-[0.2em] text-[#d4b86a]/95 md:text-xl">
                  Татгалзсан
                </div>
                {results.deny.length === 0 ? (
                  <div className="text-3xl text-[#d4b86a]/35 md:text-4xl">—</div>
                ) : (
                  results.deny.map((v) => (
                    <div
                      key={v.memberId}
                      className="mb-6 max-w-full text-3xl font-semibold leading-tight text-[#e8cf8a] md:text-4xl lg:text-5xl"
                    >
                      {v.fullName}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[#2a5a8a]/22 pb-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9a227]/72">
              Албан ёсны дүн
            </div>
            <div className="font-serif text-2xl font-semibold tracking-wide text-[#e8f4fc]">
              Хуралдаан {code}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b9cc4]">
              Сүүлийн шинэчлэлт
            </div>
            <div className="text-sm text-[#b8d4f0]">{data ? formatDateTime(data.nowISO) : "—"}</div>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 text-sm text-[#8ab4d8]">Албан дэлгэцийг ачаалж байна…</div>
        ) : null}

        {error ? (
          <div className="mt-10 rounded-lg border border-red-500/45 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!poll ? (
          <div className="mt-10 rounded-md border border-[#2a5a8a]/26 bg-[#071a2e]/48 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="font-serif text-lg font-semibold text-[#e8f4fc]">Даргын заавар хүлээгдэж байна</div>
            <p className="mt-2 text-sm text-[#8ab4d8]">
              Нийтэлсэн асуулт алга. Дэлгэц {IDLE_MS / 1000} сек тутамд шинэчлэгдэнэ.
            </p>
            {attendance ? (
              <div className="mt-4 border-t border-[#2a5a8a]/22 pt-4 text-sm text-[#b8d4f0]">
                <span className="text-[#8ab4d8]">Ирцэнд бүртгэгдсэн эрхтэй гишүүн: </span>
                <span className="font-semibold tabular-nums text-[#e8f4fc]">
                  {attendance.eligibleMemberCount}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {poll && poll.isActive ? (
          <div className="mt-8 rounded-md border border-[#2a5a8a]/24 bg-[#071a2e]/42 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.035)] ring-1 ring-[#c9a227]/12">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9a227]/72">
              Санал нээлттэй
            </div>
            <div className="font-serif mt-2 text-xl font-semibold text-[#e8f4fc] md:text-2xl">{poll.problem}</div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-[#2a5a8a]/28 bg-[#0a2740]/55 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8ab4d8]">
                  Үлдсэн хугацаа
                </div>
                <div className="mt-1 font-mono text-6xl font-bold tabular-nums text-[#e8f4fc]">
                  {receiveAt == null ? "…" : (remainingSeconds ?? 0)}
                </div>
                {poll.durationSeconds ? (
                  <div className="mt-2 text-xs text-[#6b9cc4]">
                    {poll.durationSeconds} секийн нийтэлсэн цонх
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-[#2a5a8a]/24 bg-[#071a2e]/52 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#8ab4d8]">Бүртгэл</div>
                <div className="mt-1 text-sm text-[#c8dff0]">Нээгдсэн: {formatDateTime(poll.startedAt)}</div>
                <div className="mt-3 text-sm text-[#8ab4d8]">Хаагдах: {formatDateTime(poll.endsAt)}</div>
              </div>
            </div>

            {attendance ? (
              <div className="mt-4 rounded-md border border-[#2a5a8a]/22 bg-[#071a2e]/48 px-4 py-4 ring-1 ring-inset ring-[#c9a227]/10">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9a227]/68">
                  Ирц ба санал
                </div>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 sm:grid sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-[#8ab4d8]">Эрхтэй гишүүн (хуралдаанд)</div>
                    <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-[#e8f4fc]">
                      {attendance.eligibleMemberCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8ab4d8]">Санал өгсөн / ирц</div>
                    <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-[#7ec8ff]">
                      {attendance.votesCastCount}{" "}
                      <span className="text-lg font-semibold text-[#8ab4d8]">/ {attendance.eligibleMemberCount}</span>
                    </div>
                  </div>
                  <div className="w-full sm:col-span-2">
                    <div className="text-xs text-[#8ab4d8]">Ирцийн санал (дууссан хувь)</div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#071a2e]/90 ring-1 ring-[#2a5a8a]/22">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(23,100,155,0.88),rgba(42,143,212,0.75))] transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, attendance.voteParticipationPercent)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-right font-mono text-sm font-semibold tabular-nums text-[#c8dff0]">
                      {attendance.eligibleMemberCount === 0
                        ? "—"
                        : `${attendance.voteParticipationPercent.toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showClosedSummary ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-md border border-[#2a5a8a]/26 bg-[#071a2e]/48 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c9a227]/72">
                Санал хаагдсан
              </div>
              <div className="font-serif mt-2 text-xl font-semibold text-[#e8f4fc] md:text-2xl">{poll.problem}</div>
              <div className="mt-3 text-sm text-[#8ab4d8]">
                Нээгдсэн: {formatDateTime(poll.startedAt)} <br />
                Хаагдсан: {formatDateTime(poll.closedAt ?? poll.endsAt)}
              </div>
            </div>

            {attendance ? (
              <div className="rounded-md border border-[#2a5a8a]/22 bg-[#071a2e]/48 px-4 py-4 ring-1 ring-inset ring-[#c9a227]/10">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9a227]/68">
                  Ирц ба санал (эцсийн)
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-[#8ab4d8]">Эрхтэй гишүүн</div>
                    <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#e8f4fc]">
                      {attendance.eligibleMemberCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8ab4d8]">Санал өгсөн</div>
                    <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#7ec8ff]">
                      {attendance.votesCastCount}
                      <span className="text-base font-semibold text-[#8ab4d8]">
                        {" "}
                        / {attendance.eligibleMemberCount}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8ab4d8]">Ирцийн санал</div>
                    <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#c8dff0]">
                      {attendance.eligibleMemberCount === 0
                        ? "—"
                        : `${attendance.voteParticipationPercent.toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#2a5a8a]/26 bg-[#0a2740]/65 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-[#17649b]/12">
                <div className="text-sm text-[#b8d4f0]">Зөвшөөрөх</div>
                <div className="mt-1 text-5xl font-bold text-[#e8f4fc]">{results.approvePercent.toFixed(1)}%</div>
                <div className="mt-1 text-sm text-[#8ab4d8]">
                  {results.approveCount} / {results.totalVotes} санал
                </div>
                <div className="mt-4 space-y-2">
                  {results.approve.length === 0 ? (
                    <div className="text-sm text-[#6b9cc4]">Байхгүй</div>
                  ) : (
                    results.approve.map((v) => (
                      <div key={v.memberId} className="text-sm text-[#c8dff0]">
                        {v.fullName}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[#2a5a8a]/26 bg-[#0a2740]/65 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-[#c9a227]/10">
                <div className="text-sm text-[#e8d9a8]/95">Татгалзах</div>
                <div className="mt-1 text-5xl font-bold text-[#fde047]">{results.denyPercent.toFixed(1)}%</div>
                <div className="mt-1 text-sm text-[#8ab4d8]">
                  {results.denyCount} / {results.totalVotes} санал
                </div>
                <div className="mt-4 space-y-2">
                  {results.deny.length === 0 ? (
                    <div className="text-sm text-[#6b9cc4]">Байхгүй</div>
                  ) : (
                    results.deny.map((v) => (
                      <div key={v.memberId} className="text-sm text-[#fde047]">
                        {v.fullName}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
