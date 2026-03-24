import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10 md:px-8">
      <main className="grid w-full gap-5 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-white/30 bg-[#0077b8]/55 p-6 backdrop-blur-sm">
          <h2 className="gov-section-title text-2xl font-semibold text-white">Хуралдаанд нэгдэх</h2>
          <Link
            className="gov-btn-primary mt-5 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold"
            href="/join"
          >
            Нэгдэх
          </Link>
        </section>

        <section className="flex flex-col rounded-xl border border-white/30 bg-[#0077b8]/55 p-6 backdrop-blur-sm">
          <h2 className="gov-section-title text-2xl font-semibold text-white">Хуралдаан үүсгэх</h2>
          <Link
            className="gov-btn-primary mt-5 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold"
            href="/admin"
          >
            Үүсгэх
          </Link>
        </section>
      </main>
    </div>
  );
}
