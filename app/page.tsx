import Link from "next/link";

const tools = [
  {
    title: "Schedule Maker",
    description: "Build a weekly stream schedule with a live preview. It also got a nice lil discord timezone feature.",
    href: "/schedule",
    status: "Should work fine",
  },
  {
    title: "Go-Live Post",
    description: "Generate reusable go-live posts for Discord and socials.",
    href: "#",
    status: "Soon",
  },
  {
    title: "Stream Recap",
    description: "Turn stream notes into a clean recap card.",
    href: "#",
    status: "Soon",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-violet-300">
          Streamer Tools
        </p>

        <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-7xl">
          Small tools for annoying streamer tasks.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          No account. No Canva replacement. Just fast tools for things streamers
          need to make again and again. Made by Holzig 👍. This is basically still just a alpha... maybe beta, so only the schedule maker works. Dont forget to export ur template, otherwise its GONE.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {tools.map((tool) => {
            const disabled = tool.href === "#";

            const card = (
              <div className="h-full rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-violet-400/70 hover:bg-slate-900">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold">{tool.title}</h2>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    {tool.status}
                  </span>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  {tool.description}
                </p>
              </div>
            );

            return disabled ? (
              <div key={tool.title} className="cursor-not-allowed opacity-55">
                {card}
              </div>
            ) : (
              <Link key={tool.title} href={tool.href}>
                {card}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}