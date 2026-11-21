import { Suspense } from "react";
import DiscoverPageClient from "@/modules/community/components/discover/DiscoverPageClient";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbSchema, JsonLd } from "@/modules/community/components/seo/JsonLd";

export const metadata = buildMetadata({
  title: "Discover Groups, Topics & Parents",
  description:
    "Discover sports groups, trending topics, and parents to connect with on the PowerMySport community.",
  path: "/discover",
});

export default function DiscoverPage() {
  return (
    <>
      {/* Breadcrumb only. No ItemList: the groups listed here are largely
          member-created and can be private, and the public listing endpoint is
          personalised — restating it as a fixed schema list would publish
          something that is neither stable nor uniformly public. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: "Community", path: "/" },
          { name: "Discover", path: "/discover" },
        ])}
      />
      <Suspense
        fallback={
          <div aria-busy="true" aria-label="Loading" className="community-page-shell">
            <div className="community-content-wrap">
              <div className="bg-paper-deep h-44 animate-pulse rounded-2xl" />
            </div>
          </div>
        }
      >
        <DiscoverPageClient />
      </Suspense>
    </>
  );
}
