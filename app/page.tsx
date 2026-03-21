import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8">
      <div className="border-b border-[#c9a227]/25 pb-8">
        <p className="gov-label text-[#d4bc6a]">Мэдээллийн систем</p>
        <h1 className="gov-section-title mt-2 text-3xl font-semibold text-[#e8f4fc] md:text-4xl">
          Парламентын санал хураалтын хуралдаан
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#8ab4d8]">
          Өрөөний кодоор нэвтрэх, бүртгэгдсэн санал, танхим эсвэл хорооны хуралдаанд зориулсан нийтийн дүнгийн
          дэлгэц.
        </p>
      </div>

      <main className="mt-10 grid gap-5 md:grid-cols-3">
        <section className="gov-panel flex flex-col p-6">
          <div className="gov-panel-header -mx-6 -mt-6 mb-4 rounded-t px-6 py-3">
            <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Гишүүний санал</h2>
          </div>
          <p className="text-sm leading-relaxed text-[#b8d4f0]">
            Нийтэлсэн хуралдааны код болон бүтэн нэрээ оруулна уу. Дарга асуултыг нээхэд «Зөвшөөрөх» эсвэл
            «Татгалзах» саналаа өгнө.
          </p>
          <Link
            className="gov-btn-primary mt-auto inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold"
            href="/join"
          >
            Гишүүний нэвтрэлт рүү орох
          </Link>
        </section>

        <section className="gov-panel flex flex-col p-6">
          <div className="gov-panel-header -mx-6 -mt-6 mb-4 rounded-t px-6 py-3">
            <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Танхимын удирдлага</h2>
          </div>
          <p className="text-sm leading-relaxed text-[#b8d4f0]">
            Хуралдаан нээх, асуултыг нийтлэх, санал хураалтын цонхыг тохируулах (10 / 15 / 25 сек эсвэл
            өөрөө) ба ирцийг удирдах.
          </p>
          <Link
            className="gov-btn-primary mt-auto inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold"
            href="/admin"
          >
            Удирдлагын самбар
          </Link>
        </section>

        <section className="gov-panel flex flex-col border-[#c9a227]/40 p-6 ring-1 ring-[#c9a227]/25">
          <div className="gov-panel-header -mx-6 -mt-6 mb-4 rounded-t border-b border-[#c9a227]/25 px-6 py-3">
            <h2 className="gov-section-title text-lg font-semibold text-[#e8f4fc]">Нийтийн дэлгэц</h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-[#c9a227]/90">
              Албан ёсны дүн · проектор
            </p>
          </div>
          <p className="text-sm leading-relaxed text-[#b8d4f0]">
            Бүтэн дэлгэцийн тоолох хугацаа, саналын нэрсийн жагсаалт, эцсийн хувь хэмжээг хуралдаанд харуулна.
          </p>
          <Link
            className="mt-auto inline-flex w-full items-center justify-center rounded-md border border-[#c9a227]/50 bg-[#0a2740]/90 px-4 py-2.5 text-sm font-semibold text-[#e8d9a8] shadow-sm hover:bg-[#0d3558]"
            href="/screen"
          >
            Нийтийн дэлгэцийг нээх
          </Link>
        </section>
      </main>
    </div>
  );
}
