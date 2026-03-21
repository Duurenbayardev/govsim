"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminMembersResponse = {
  members: Array<{ id: string; fullName: string; joinedAt: string; kickedAt: string | null }>;
  poll: {
    id: string;
    problem: string;
    startedAt: string;
    endsAt: string;
    status: "open" | "closed";
  } | null;
};

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
    votesCastCount: number;
    voteParticipationPercent: number;
  };
};

function msToSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function AdminSessionPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = params.code;
  const adminKey = searchParams.get("key") ?? "";

  const [members, setMembers] = useState<AdminMembersResponse["members"]>([]);
  const [pollFromScreen, setPollFromScreen] = useState<ScreenResponse["poll"]>(null);
  const [results, setResults] = useState<ScreenResponse["results"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [durationPreset, setDurationPreset] = useState<"10" | "15" | "25" | "custom">("10");
  const [customDuration, setCustomDuration] = useState("30");
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tick, setTick] = useState(0);

  const xAdminKey = adminKey;

  const loadMembers = useCallback(async () => {
    if (!xAdminKey) return;
    const res = await fetch(`/api/admin/sessions/${code}/members`, {
      headers: { "X-Admin-Key": xAdminKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(text || "Гишүүдийг ачаалж чадсангүй.");
      return;
    }
    const json: { members: AdminMembersResponse["members"] } = await res.json();
    setMembers(json.members);
  }, [xAdminKey, code]);

  const loadScreen = useCallback(async () => {
    const res = await fetch(`/api/session/${code}/screen`);
    if (!res.ok) return;
    const json: ScreenResponse = await res.json();
    setPollFromScreen(json.poll);
    setResults(json.results);
  }, [code]);

  const refreshAll = useCallback(async () => {
    if (!xAdminKey) return;
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadMembers(), loadScreen()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    } finally {
      setRefreshing(false);
    }
  }, [xAdminKey, loadMembers, loadScreen]);

  useEffect(() => {
    if (!xAdminKey) return;
    void (async () => {
      try {
        await Promise.all([loadMembers(), loadScreen()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
      }
    })();
  }, [xAdminKey, code, loadMembers, loadScreen]);

  useEffect(() => {
    if (!pollFromScreen?.isActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt]);

  const remaining = useMemo(() => {
    if (!pollFromScreen?.isActive) return null;
    void tick;
    return msToSeconds(new Date(pollFromScreen.endsAt).getTime() - Date.now());
  }, [pollFromScreen?.isActive, pollFromScreen?.endsAt, tick]);

  function resolveDurationSeconds(): number {
    if (durationPreset === "custom") {
      const n = parseInt(customDuration, 10);
      return Math.min(600, Math.max(5, Number.isNaN(n) ? 10 : n));
    }
    return parseInt(durationPreset, 10);
  }

  async function startPoll() {
    if (!xAdminKey) return;
    const p = problem.trim();
    if (p.length < 3) {
      setError("Санал хураалтад оруулах асуултыг бичнэ үү.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${code}/poll/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": xAdminKey,
        },
        body: JSON.stringify({ problem: p, durationSeconds: resolveDurationSeconds() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Санал эхлүүлж чадсангүй.");
        return;
      }
      const json: { pollId: string; durationSeconds: number } = await res.json();
      setProblem("");
      setError(`Санал эхэллээ (${json.pollId}, ${json.durationSeconds} сек).`);
      await loadScreen();
    } finally {
      setStarting(false);
    }
  }

  async function closePoll() {
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
  }

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

  async function kick(memberId: string) {
    if (!xAdminKey) return;
    setError(null);
    const ok = window.confirm("Энэ гишүүнийг хуралдаанаас хасах уу?");
    if (!ok) return;

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
      setError("Гишүүн хасагдлаа.");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#c9a227]/20 pb-6">
        <div>
          <p className="gov-label text-[#d4bc6a]">Удирдлага</p>
          <h1 className="gov-section-title mt-1 text-2xl font-semibold text-[#e8f4fc] md:text-3xl">
            Удирдлагын самбар · {code}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#8ab4d8]">
            Асуултыг нийтлэх, санал хураалтын цонхыг удирдах, ирцийн жагсаалтыг хадгалах. Шинэчлэлт сүүлийн
            төлөвийг татна.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {xAdminKey ? (
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-md border border-[#2a5a8a]/55 bg-[#071a2e]/70 px-3 py-2 text-sm font-semibold text-[#c8dff0] shadow-sm hover:bg-[#0a2740] disabled:opacity-60"
            >
              {refreshing ? "…" : "Шинэчлэх"}
            </button>
          ) : null}
          <Link
            href={`/screen/${code}`}
            className="inline-flex items-center justify-center rounded-md border border-[#2a5a8a]/50 bg-[#071a2e]/60 px-3 py-2 text-sm font-semibold text-[#c8dff0] hover:bg-[#0a2740]"
          >
            Нийтийн дэлгэц
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-[#2a5a8a]/55 bg-[#071a2e]/70 px-3 py-2 text-sm font-semibold text-[#c8dff0] shadow-sm hover:bg-[#0a2740]"
          >
            Шинэ хуралдаан
          </Link>
          {xAdminKey ? (
            <button
              type="button"
              onClick={deleteSession}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-md border border-red-500/45 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/50 disabled:opacity-60"
            >
              {deleting ? "…" : "Хуралдаан устгах"}
            </button>
          ) : null}
        </div>
      </div>

      {!xAdminKey ? (
        <div className="mt-6 rounded-md border border-red-500/40 bg-red-950/30 p-5 text-sm text-red-200">
          Админ түлхүүр шаардлагатай. Хуралдаан үүсгэж үед олгосон холбоосоор энэ хуудсыг нээнэ үү.
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded border border-amber-200/40 bg-[#2a1f0a]/40 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="gov-panel p-6">
          <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Санал нээх</h2>
          <label className="mt-3 block">
            <span className="gov-label">Асуулт / тавигдсан санал</span>
            <textarea
              className="gov-input mt-2 w-full px-3 py-2"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              placeholder="Жишээ нь: А шийдлийг зөвшөөрөх"
            />
          </label>

          <div className="mt-4">
            <span className="gov-label">Санал хураалтын цонх (секунд)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["10", "15", "25"] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={!!pollFromScreen?.isActive}
                  onClick={() => {
                    setDurationPreset(sec);
                  }}
                  className={[
                    "rounded-md border px-3 py-1.5 text-sm font-semibold",
                    durationPreset === sec
                      ? "border-[#17649b] bg-[#17649b] text-white"
                      : "border-[#2a5a8a]/45 bg-[#071a2e]/60 text-[#c8dff0] hover:bg-[#0a2740]",
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
                  "rounded-md border px-3 py-1.5 text-sm font-semibold",
                  durationPreset === "custom"
                    ? "border-[#17649b] bg-[#17649b] text-white"
                    : "border-[#2a5a8a]/45 bg-[#071a2e]/60 text-[#c8dff0] hover:bg-[#0a2740]",
                ].join(" ")}
              >
                Өөрөө
              </button>
            </div>
            {durationPreset === "custom" ? (
              <label className="mt-2 block">
                <span className="text-xs text-[#8ab4d8]">Секунд (5–600)</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  className="gov-input mt-1 w-full max-w-[120px] px-3 py-2"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!xAdminKey || starting || !!pollFromScreen?.isActive}
              onClick={startPoll}
              className="gov-btn-primary rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {starting ? "Нийтэлж байна…" : "Санал эхлүүлэх"}
            </button>
            <button
              type="button"
              disabled={!xAdminKey || closing || !pollFromScreen || !pollFromScreen.isActive}
              onClick={closePoll}
              className="rounded-md border border-[#2a5a8a]/55 bg-[#0d3558] px-4 py-2.5 text-sm font-semibold text-[#c8dff0] hover:bg-[#123a5c] disabled:opacity-60"
            >
              {closing ? "Хааж байна…" : "Санал хаах"}
            </button>
          </div>

          {pollFromScreen ? (
            <div className="mt-4 rounded-md border border-[#2a5a8a]/40 bg-[#071a2e]/60 px-3 py-3 text-sm text-[#c8dff0]">
              <div className="gov-label">Одоогийн хөдөлгөөн</div>
              <div className="mt-1 font-medium text-[#e8f4fc]">{pollFromScreen.problem}</div>
              <div className="mt-2 text-[#8ab4d8]">
                {pollFromScreen.isActive ? `Үлдсэн хугацаа: ${remaining ?? 0} сек` : "Хаагдсан"}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-[#8ab4d8]">Бүртгэлд идэвхтэй эсвэл өмнөх санал алга.</div>
          )}
        </div>

        <div className="gov-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Ирц</h2>
            {xAdminKey ? (
              <button
                type="button"
                onClick={async () => {
                  setRefreshingMembers(true);
                  setError(null);
                  try {
                    await loadMembers();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Сүлжээний алдаа.");
                  } finally {
                    setRefreshingMembers(false);
                  }
                }}
                disabled={refreshingMembers}
                className="shrink-0 rounded-md border border-[#2a5a8a]/55 bg-[#071a2e]/70 px-3 py-1.5 text-xs font-semibold text-[#c8dff0] hover:bg-[#0a2740] disabled:opacity-60"
              >
                {refreshingMembers ? "…" : "Шинэчлэх"}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#8ab4d8]">
            Цаашид санал өгөх ёсгүй гишүүнийг жагсаалтаас хасна уу. Шинэчлэлтээр синк хийнэ.
          </p>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
            {members.length === 0 ? (
              <div className="text-sm text-[#8ab4d8]">Бүртгэлд гишүүн алга.</div>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[#2a5a8a]/35 bg-[#071a2e]/55 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#e8f4fc]">{m.fullName}</div>
                    <div className="mt-1 text-xs text-[#8ab4d8]">
                      {m.kickedAt ? "Хасагдсан" : "Эрхтэй"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!xAdminKey || !!m.kickedAt}
                    onClick={() => kick(m.id)}
                    className="rounded-md border border-[#17649b] bg-[#17649b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#155a94] disabled:opacity-60"
                  >
                    Хасах
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="gov-panel mt-4 p-6">
        <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Бүртгэгдсэн дүн (урьдчилан харах)</h2>
        {!results || !pollFromScreen || pollFromScreen.isActive ? (
          <p className="mt-2 text-sm text-[#8ab4d8]">Дүн нь дарга саналыг хаасны дараа харагдана.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-[#2a5a8a]/40 bg-[#071a2e]/55 p-4">
              <div className="text-sm font-semibold text-[#c8dff0]">Зөвшөөрөх</div>
              <div className="mt-1 font-mono text-xl font-semibold text-[#7ec8ff]">
                {results.approvePercent.toFixed(1)}%
              </div>
              <div className="mt-3 space-y-2">
                {results.approve.length === 0 ? <div className="text-sm text-[#6b9cc4]">Байхгүй</div> : null}
                {results.approve.map((v) => (
                  <div key={v.memberId} className="text-sm text-[#b8d4f0]">
                    {v.fullName}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-[#2a5a8a]/40 bg-[#071a2e]/55 p-4">
              <div className="text-sm font-semibold text-[#fde68a]">Татгалзах</div>
              <div className="mt-1 font-mono text-xl font-semibold text-[#fde047]">
                {results.denyPercent.toFixed(1)}%
              </div>
              <div className="mt-3 space-y-2">
                {results.deny.length === 0 ? <div className="text-sm text-[#6b9cc4]">Байхгүй</div> : null}
                {results.deny.map((v) => (
                  <div key={v.memberId} className="text-sm text-[#fde047]">
                    {v.fullName}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
