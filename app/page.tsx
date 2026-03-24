import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-10 md:px-8">
      <main className="w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center rounded-full border border-white/30 bg-[#005a8b]/45 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/85">
            GovSim
          </div>
          <h1 className="gov-section-title mt-3 text-3xl font-semibold text-white md:text-4xl">Санал хураалтын систем</h1>
        </div>

        <section className="group relative overflow-hidden rounded-2xl border border-white/35 bg-[#0077b8]/55 p-7 shadow-[0_14px_40px_rgba(0,38,62,0.35)] transition hover:translate-y-[-2px] hover:shadow-[0_20px_50px_rgba(0,38,62,0.45)]">
          <h2 className="gov-section-title flex items-center gap-3 text-2xl font-semibold text-white md:text-3xl">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 17l5-5-5-5" />
              <path d="M4 12h12" />
            </svg>
            Хуралдаанд нэгдэх
          </h2>
          <p className="mt-2 text-sm text-white/85">Код болон нэрээ оруулаад шууд санал өгнө.</p>
          <Link
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-white/50 bg-white/20 px-4 py-3 text-base font-semibold text-white transition hover:bg-white/30"
            href="/join"
          >
            Нэгдэх
          </Link>
        </section>

        <section className="group relative hidden overflow-hidden rounded-2xl border border-white/35 bg-[#0077b8]/55 p-7 shadow-[0_14px_40px_rgba(0,38,62,0.35)] transition hover:translate-y-[-2px] hover:shadow-[0_20px_50px_rgba(0,38,62,0.45)] md:block">
          <h2 className="gov-section-title flex items-center gap-3 text-2xl font-semibold text-white md:text-3xl">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Хуралдаан үүсгэх
          </h2>
          <p className="mt-2 text-sm text-white/85">Зөвхөн компьютер/таблетаас удирдлагын самбар ашиглана.</p>
          <Link
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-white/50 bg-white/20 px-4 py-3 text-base font-semibold text-white transition hover:bg-white/30"
            href="/admin"
          >
            Үүсгэх
          </Link>
        </section>
      </main>
    </div>
  );
}
