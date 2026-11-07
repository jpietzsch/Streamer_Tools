import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <article className="mx-auto w-full max-w-3xl px-6 py-16 leading-7 text-slate-300">
        <Link
          href="/"
          className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-violet-400 hover:text-white"
        >
          ← Back
        </Link>

        <h1 className="mt-8 text-4xl font-black tracking-tight text-slate-50">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 7 November 2026</p>

        <Section title="Who is responsible">
          <p>
            Justin Pietzsch
            <br />
            Email:{" "}
            <a
              href="mailto:justin.pietzsch.2003@gmail.com"
              className="text-violet-300 underline hover:text-violet-200"
            >
              justin.pietzsch.2003@gmail.com
            </a>
          </p>
          <p>
            Streamer Tools is a private, non-commercial project. It has no
            accounts, no comments and no ads.
          </p>
        </Section>

        <Section title="Your images and templates stay with you">
          <p>
            Everything you make in the tools happens inside your browser. Images
            you add, your schedule and your templates are never uploaded to a
            server. Exported PNGs and templates are saved straight to your
            device. Nothing is stored after you close the tab, which is why you
            should export your template.
          </p>
          <p>
            The copy buttons for Discord timestamps write text to your
            clipboard only when you press them.
          </p>
        </Section>

        <Section title="What happens when you visit">
          <p>
            The site is hosted by Netlify, Inc., 101 2nd Street, San Francisco,
            CA 94105, USA. To deliver the pages, Netlify&apos;s servers have to
            process technical data about your request: your IP address, the date
            and time, the page or file requested and the browser information
            your device sends. This can end up in Netlify&apos;s server logs. I
            don&apos;t receive or look at these logs.
          </p>
          <p>
            Legal basis: Art. 6(1)(f) GDPR. My legitimate interest is delivering
            the site to you and keeping it secure. Netlify processes this data
            on my behalf as a processor (Art. 28 GDPR) and decides how long its
            logs are kept.
          </p>
          <p>
            Netlify is a US company, so this data can be processed in the USA.
            Netlify is certified under the EU-U.S. Data Privacy Framework, for
            which the European Commission has issued an adequacy decision (Art.
            45 GDPR). Details:{" "}
            <a
              href="https://www.netlify.com/privacy/"
              className="text-violet-300 underline hover:text-violet-200"
            >
              Netlify&apos;s privacy statement
            </a>
            .
          </p>
        </Section>

        <Section title="What this site does not do">
          <p>
            No cookies, no local storage, no analytics, no tracking and no
            advertising. Fonts are served from this site itself, so your browser
            doesn&apos;t contact any other service while you use it.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask me which data about you is processed (Art. 15 GDPR), and
            ask for it to be corrected (Art. 16), deleted (Art. 17) or restricted
            (Art. 18). Because the processing relies on legitimate interest, you
            can object to it (Art. 21). Since I have no access to Netlify&apos;s
            logs, I will forward such requests to Netlify where needed. Just
            email me.
          </p>
          <p>
            You also have the right to complain to a data protection supervisory
            authority (Art. 77 GDPR), for example the one in the country where
            you live.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold text-slate-50">{title}</h2>
      {children}
    </section>
  );
}
