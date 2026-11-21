import { Suspense } from "react";
import CommunityHomeClient from "@/modules/community/components/page/CommunityHomeClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Chats",
  description: "Your direct messages and group chats in the PowerMySport community.",
  path: "/chats",
  noindex: true,
});

export default function ChatsPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading chats"
          className="bg-paper flex h-screen items-center justify-center"
        >
          <p className="font-editorial text-ink-muted animate-pulse text-2xl font-light">
            Loading chats
          </p>
        </div>
      }
    >
      <CommunityHomeClient forceView="conversations" />
    </Suspense>
  );
}
