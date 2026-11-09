import { PageHeader } from "@/modules/shared/ui/PageHeader";
import type { Metadata } from "next";

/**
 * Public description of PowerMySport's data reader, for the people who run the
 * sites it reads (and for Cloudflare's Verified Bots review, which asks for one).
 * Everything stated here is enforced in server/src/shared/services/aita/: keep the
 * two in step when either changes.
 */

export const metadata: Metadata = {
  title: "PowerMySportBot",
  description:
    "What PowerMySport's data reader reads, how slowly, how it identifies itself, and how to contact or block it.",
  alternates: { canonical: "/bot" },
};

const USER_AGENT = "PowerMySportBot/1.0 (+https://powermysport.com/bot; teams@powermysport.com)";
const KEY_DIRECTORY = "https://powermysport.com/.well-known/http-message-signatures-directory";

export default function BotPage() {
  return (
    <main className="bg-paper min-h-screen">
      <PageHeader
        title="PowerMySportBot"
        size="compact"
        width="4xl"
        meta={<>Last updated 10 November 2026</>}
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <article className="legal-content legal-prose max-w-[72ch]">
          <section className="mb-8">
            <h2 className="mb-4 mt-2 text-2xl font-semibold">What it is</h2>
            <p>
              PowerMySportBot is the automated reader PowerMySport uses to keep a copy of publicly
              published tennis information for Indian parents and players: the All India Tennis
              Association (AITA) ranking lists, its tournament calendar, and tournament acceptance
              lists. We show this information on powermysport.com, credited to AITA and linked back
              to the official pages.
            </p>
            <p className="mt-3">
              It does not log in, submit forms, buy anything, or read anything behind an account. It
              does not train AI models on what it reads.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 mt-8 text-2xl font-semibold">How it identifies itself</h2>
            <p>Every request sends this user agent:</p>
            <pre className="mt-3 overflow-x-auto rounded-md border bg-white p-3 text-sm">
              <code>{USER_AGENT}</code>
            </pre>
            <p className="mt-3">
              Requests are also signed with{" "}
              <a href="https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/">
                Web Bot Auth
              </a>{" "}
              (HTTP Message Signatures, Ed25519), so a site can confirm a request really came from
              us. Our public keys are published at <a href={KEY_DIRECTORY}>{KEY_DIRECTORY}</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 mt-8 text-2xl font-semibold">What it reads, and how often</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Only <code>www.aita.hitcourt.com</code>, AITA&apos;s official site: ranking lists,
                the list of published ranking weeks, the tournament calendar and acceptance lists.
              </li>
              <li>
                One request at a time, never in parallel, at least 1.5 seconds apart, and slower if
                the site&apos;s robots.txt asks for a longer crawl delay.
              </li>
              <li>
                Ranking lists are read when a new week is published: about 12 lists a week, 100 rows
                per page. A small check (one request) runs hourly to see whether a new week exists.
              </li>
              <li>
                Occasionally a one-time catch-up of earlier ranking weeks, at the same pace, at a
                time agreed with the site owner where we can.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 mt-8 text-2xl font-semibold">robots.txt</h2>
            <p>
              PowerMySportBot reads and obeys robots.txt. It follows the rules for{" "}
              <code>PowerMySportBot</code> where a site names it, and the rules for <code>*</code>{" "}
              otherwise, including <code>Crawl-delay</code>. To stop it reading your site, add:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border bg-white p-3 text-sm">
              <code>{"User-agent: PowerMySportBot\nDisallow: /"}</code>
            </pre>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 mt-8 text-2xl font-semibold">Contact</h2>
            <p>
              If PowerMySportBot is causing you any trouble, or you would rather share data another
              way (an export or a feed), email{" "}
              <a href="mailto:teams@powermysport.com">teams@powermysport.com</a>. A person reads
              every message, and we will slow it down or stop it on request.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
