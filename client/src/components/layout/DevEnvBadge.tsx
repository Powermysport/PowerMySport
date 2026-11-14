"use client";

import { useEffect } from "react";

/**
 * Marks a page as running from LOCAL, development code, so it cannot be mistaken
 * for production in a tab bar full of both.
 *
 * It exists because code is sometimes changed locally while production is the
 * thing being looked at, and the two look identical. Anything on a page that
 * carries this marker is dev code; a page without it is not.
 *
 * Three cues, so at least one survives whatever else is on screen:
 *   - a thin cyan strip across the very top of the window,
 *   - a small "DEV" tab hanging from it, naming the app,
 *   - "[DEV] " in front of the browser tab's title.
 *
 * Renders nothing in production: `NODE_ENV` is "production" for `next build` and
 * `next start` and for every deployed build, so production output is unchanged,
 * with no markup, no script and no style. Inline styles only, so it does not depend
 * on the app's Tailwind setup and cannot be pruned or restyled by it.
 *
 * The same file lives in client, admin and community; keep the three in step.
 */
const COLOR = "#0e7490";
const TITLE_PREFIX = "[DEV] ";

export function DevEnvBadge({ app }: { app: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return <DevMarker app={app} />;
}

function DevMarker({ app }: { app: string }) {
  useEffect(() => {
    const mark = () => {
      if (!document.title.startsWith(TITLE_PREFIX)) {
        document.title = `${TITLE_PREFIX}${document.title}`;
      }
    };
    mark();
    // Pages and client-side navigation keep rewriting the title; put the prefix
    // back each time. Idempotent, so setting the title here does not loop.
    const observer = new MutationObserver(mark);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden
      data-dev-env={app}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: COLOR,
        zIndex: 2147483000,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "1px 8px 2px",
          borderRadius: "0 0 6px 6px",
          background: COLOR,
          color: "#fff",
          font: "700 10px/14px system-ui, sans-serif",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        DEV · {app}
      </span>
    </div>
  );
}
