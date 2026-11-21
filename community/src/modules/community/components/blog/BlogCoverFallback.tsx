"use client";

import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";

/**
 * Cover shown when a post has no uploaded image: a deeper-paper block with the
 * topic icon and name, quiet enough that real photographs still lead.
 */
export default function BlogCoverFallback({
  topic,
  className = "",
  compact = false,
}: {
  topic?: string | null;
  className?: string;
  /** Icon only, for the small thumbnail in list rows where the label will not fit. */
  compact?: boolean;
}) {
  const { label, Icon } = getTopicMeta(topic);

  return (
    <div
      className={`bg-paper-deep text-ink-muted flex h-full w-full flex-col items-center justify-center gap-3 ${className}`}
    >
      <Icon size={compact ? 28 : 32} strokeWidth={1.25} aria-hidden="true" />
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="font-editorial text-xl font-light">{label}</span>
      )}
    </div>
  );
}
