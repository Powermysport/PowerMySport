// ─── What each sport's /roadmap card shows ─────────────────────────────────
//
// Keyed by the pathway's `sportSlug`. A photograph and a one-sentence summary
// of what the guide walks a parent through. Both are optional: a sport missing
// from this map still gets a card, with a plain cream band and a summary built
// from its stage count, so a newly published sport never breaks the grid.
//
// ── Summaries ──
// One sentence, about 20 words, drawn from the guide's own stage questions
// (should we start, the basics, where they stand, how far, after school). Say
// what the guide covers; never promise outcomes.
//
// ── Photos ──
// Landscape, the child shown whole, warm light, children actually playing.
// Unsplash photos are hotlinked (the site's image config allows
// images.unsplash.com) and served through next/image; `page` is the photo's
// Unsplash page, kept for credit and for checking the licence. The band is
// 3:2; `position` moves the crop when the subject is off-centre.
//
// When pathways gain image and summary fields in the CMS, this becomes the
// fallback.

export interface SportPhoto {
  src: string;
  alt: string;
  /** A Tailwind `object-[x_y]` class, when the subject is not in the middle. */
  position?: string;
  /** Where the photo came from, for credit and licence checks. */
  page?: string;
}

export interface SportCardContent {
  photo?: SportPhoto;
  summary?: string;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=75`;

export const SPORT_CARDS: Record<string, SportCardContent> = {
  tennis: {
    photo: {
      src: "/images/hero-tennis.jpg",
      alt: "A girl hitting a backhand on an outdoor tennis court at sunset while her coach watches",
      position: "object-[68%_45%]",
    },
    summary:
      "Whether to start, when to get serious, and how AITA junior tournaments fit in, age by age.",
  },
  cricket: {
    photo: {
      src: unsplash("photo-1581776156419-7fa259c2a144"),
      alt: "A boy batting on a dusty open ground in the evening while other children play behind him",
      position: "object-[50%_60%]",
      page: "https://unsplash.com/photos/sxEZ4hyHs2A",
    },
    summary:
      "From a first bat and the basics to an honest read on your child's level, and the road after school.",
  },
  chess: {
    photo: {
      src: unsplash("photo-1745556380309-509a49b887bb"),
      alt: "A young boy moving a piece on a chess board in a library",
      page: "https://unsplash.com/photos/UGnc9kgnjV4",
    },
    summary:
      "From learning the moves to first tournaments and a rating, then titles, norms and how seriously to take it.",
  },
  badminton: {
    photo: {
      src: unsplash("photo-1793312523882-973cb2b10026"),
      alt: "A young girl lunging to return a shuttle on a green indoor badminton court",
      position: "object-[40%_60%]",
      page: "https://unsplash.com/photos/7fgsnquRYqI",
    },
    summary:
      "From a first racquet to knowing where your child stands, how far badminton can go, and what comes next.",
  },
  football: {
    photo: {
      src: unsplash("photo-1701871237912-1facf2d9304d"),
      alt: "Two boys in red and blue kits challenging for the ball during a youth football match",
      position: "object-[50%_55%]",
      page: "https://unsplash.com/photos/bBEi90TviUs",
    },
    summary:
      "From kickabouts and the basics to how good your child really is, how far football can go, and life after school.",
  },
};

export const cardContentFor = (sportSlug: string): SportCardContent =>
  SPORT_CARDS[sportSlug.toLowerCase()] ?? {};
