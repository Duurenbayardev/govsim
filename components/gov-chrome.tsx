"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GovEmblem } from "./gov-emblem";

function isProjectorScreenPath(pathname: string | null) {
  if (!pathname) return false;
  return /^\/screen\/\d{6}$/.test(pathname);
}

export function GovChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = isProjectorScreenPath(pathname);

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="gov-app-bg flex min-h-full flex-col">
      <header className="relative border-b border-[#c9a227]/18 bg-[#071a2e]/55 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(201,162,39,0.025)_50%,transparent_100%)]" />
        <div className="relative mx-auto flex max-w-5xl items-center gap-4 px-5 py-4 md:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 rounded-md outline-none ring-offset-2 ring-offset-[#071a2e] focus-visible:ring-2 focus-visible:ring-[#c9a227]/80">
            <GovEmblem className="h-11 w-11 shrink-0 opacity-[0.97] drop-shadow-[0_0_10px_rgba(201,162,39,0.14)]" />
            <div className="min-w-0 text-left">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-[#c9a227]/78">
                Парламентын санал хураалт
              </p>
              <p className="font-serif text-lg font-semibold leading-tight text-[#e8f4fc] md:text-xl">
                GovSim
              </p>
              <p className="hidden text-xs text-[#8ab4d8] sm:block">
                Албан хуралдаа · цахим санал
              </p>
            </div>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
            <Link
              className="rounded border border-[#2a5a8a]/50 bg-[#071a2e]/60 px-3 py-1.5 text-[#c8dff0] transition hover:border-[#c9a227]/45 hover:bg-[#0a2740]"
              href="/join"
            >
              Гишүүний нэвтрэлт
            </Link>
            <Link
              className="rounded border border-[#2a5a8a]/50 bg-[#071a2e]/60 px-3 py-1.5 text-[#c8dff0] transition hover:border-[#c9a227]/45 hover:bg-[#0a2740]"
              href="/admin"
            >
              Удирдлага
            </Link>
            <Link
              className="rounded border border-[#c9a227]/35 bg-[#0a2740]/80 px-3 py-1.5 text-[#e8d9a8] transition hover:bg-[#c9a227]/15"
              href="/screen"
            >
              Нийтийн дэлгэц
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-[#2a5a8a]/22 bg-[#071a2e]/45 py-4 text-center text-[11px] uppercase tracking-[0.16em] text-[#6b9cc4]/65">
        Дотоод хэрэглээ · санал хураалтын бүртгэл
      </footer>
    </div>
  );
}
