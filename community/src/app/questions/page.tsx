import QnAFeedClient from "@/modules/community/components/page/QnAFeedClient";
import { Suspense } from "react";
import { buildMetadata, fetchPublicData } from "@/lib/seo";
import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/modules/community/components/seo/JsonLd";

export const metadata = buildMetadata({
  title: "Sports Q&A — Ask & Answer Community Questions",
  description:
    "Ask sports questions and get answers from parents. Browse advice on coaching, training, equipment, injuries, nutrition, and tournaments.",
  path: "/questions",
});

interface QuestionRow {
  id: string;
  title?: string;
  content?: string;
}

export default async function CommunityQnAPage() {
  // Same reasoning as /blog: the feed is client-rendered, so the crawler needs
  // the list restated in schema to see this page has anything on it.
  const recent = await fetchPublicData<{ items?: QuestionRow[] }>(
    "/community/posts?page=1&limit=20"
  );

  const questions = (recent?.items ?? [])
    .map((row) => ({ id: row.id, name: row.title || row.content || "" }))
    .filter((row) => row.name);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Community", path: "/" },
            { name: "Q&A", path: "/questions" },
          ]),
          ...(questions.length
            ? [
                itemListSchema({
                  name: "Latest questions in the PowerMySport community",
                  path: "/questions",
                  items: questions.map((row) => ({
                    name: row.name,
                    path: `/questions/${row.id}`,
                  })),
                }),
              ]
            : []),
        ]}
      />
      <Suspense
        fallback={
          <div className="community-page-shell" aria-busy="true" aria-label="Loading questions">
            <div className="community-content-wrap">
              <div className="bg-paper-deep h-56 animate-pulse rounded-2xl" />
              <div className="border-hairline mt-8 space-y-3 border-t py-7">
                <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                <div className="bg-ink/10 h-6 w-3/4 animate-pulse rounded-sm" />
                <div className="bg-ink/10 h-4 w-full animate-pulse rounded-sm" />
              </div>
            </div>
          </div>
        }
      >
        <QnAFeedClient />
      </Suspense>
    </>
  );
}
