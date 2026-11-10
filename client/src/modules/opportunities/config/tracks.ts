import type { CycleState, OpportunityTrack, SelectionMode } from "../services/opportunities";

/**
 * Everything that differs between the two pages. The pages themselves are one
 * component; adding a third track would be an entry here and a route.
 */
export const TRACKS: Record<
  OpportunityTrack,
  {
    path: string;
    title: string;
    heading: string;
    intro: string;
    metaDescription: string;
    categories: Record<string, { label: string; blurb: string }>;
  }
> = {
  admission: {
    path: "/admissions",
    title: "Admissions",
    heading: "Sports admissions",
    intro:
      "Schools, colleges and academies that give admission, or a seat, to children who play sport. For each one we explain how it works, who can apply, and which official website we checked.",
    metaDescription:
      "Sports admissions for young athletes in India: schools, colleges and academies that give admission to children who play sport, each linked to its official source.",
    categories: {
      college: {
        label: "Colleges and universities",
        blurb:
          "Seats reserved for players (the sports quota), usually in addition to the regular seats.",
      },
      school: {
        label: "Schools",
        blurb: "Schools that consider your child's sport when giving admission.",
      },
      "exam-concession": {
        label: "Board exams and attendance",
        blurb: "What school boards allow when a tournament clashes with exams or classes.",
      },
      academy: {
        label: "Academies",
        blurb: "Full-time training programmes, and how they choose players.",
      },
      "study-abroad": {
        label: "Studying abroad",
        blurb: "Playing sport at a college outside India.",
      },
    },
  },
  scholarship: {
    path: "/scholarships",
    title: "Scholarships",
    heading: "Scholarships and funding",
    intro:
      "Money and other help for young players. For some, you fill in an application. For many others, players are chosen on their tournament results. Each one tells you which kind it is, who can get it, and which official website we checked.",
    metaDescription:
      "Sports scholarships for young athletes in India: money and support from governments, federations, companies and universities, each linked to its official source.",
    categories: {
      government: {
        label: "Government",
        blurb: "Schemes run by the Government of India and by state governments.",
      },
      federation: {
        label: "Federations",
        blurb:
          "Help from the national body that runs the sport, such as the tennis or badminton federation.",
      },
      international: {
        label: "International",
        blurb: "Programmes from international sports bodies that players from India can join.",
      },
      company: {
        label: "Companies and foundations",
        blurb: "Support from companies, trusts and NGOs.",
      },
      university: {
        label: "Universities",
        blurb: "Colleges that reduce or waive fees for players.",
      },
    },
  },
};

/** Said plainly, because "apply" against "scouted" decides what a parent does next. */
export const SELECTION_LABELS: Record<SelectionMode, { label: string; explain: string }> = {
  apply: {
    label: "Apply",
    explain: "You fill in an application form and send the documents it asks for.",
  },
  trials: {
    label: "Selection trials",
    explain: "Your child plays at a trial, and is chosen there.",
  },
  nominated: {
    label: "Nominated",
    explain:
      "There is no form to fill in. An official body puts players' names forward, usually based on their results.",
  },
  scouted: {
    label: "Picked by scouts",
    explain:
      "There is no form to fill in. Scouts watch players compete and pick the ones they want.",
  },
  recruitment: {
    label: "Recruited",
    explain:
      "Coaches look for players and contact them. Your part is to make your child easy to find, with results and videos online.",
  },
};

export const CYCLE_LABELS: Record<CycleState, string> = {
  open: "Open now",
  upcoming: "Opening soon",
  closed: "Closed for now",
  rolling: "No fixed dates",
};

export const OWNER_TYPE_LABELS: Record<string, string> = {
  "central-government": "Government of India",
  "state-government": "State government",
  federation: "Sports federation",
  "international-body": "International body",
  university: "University",
  "school-board": "School board",
  "public-sector-company": "Public-sector company",
  company: "Company",
  foundation: "Foundation",
};

/** The site's WhatsApp number, the one every other "ask us" link uses. */
const WHATSAPP_NUMBER = "918968582443";

/**
 * A WhatsApp link, with the message already written, for a parent who did not
 * find what they were after. It goes to a person; there is no form behind it.
 */
export function askUsHref(track: OpportunityTrack, sportLabel?: string): string {
  const what = track === "scholarship" ? "a sports scholarship" : "a sports admission route";
  const text = `Hi! I'm looking for ${what}${sportLabel ? ` for ${sportLabel}` : ""} for my child and did not find it on PowerMySport. Can you help?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Below this many entries a list is shown flat, with the category on each card.
 * Grouped into five headed sections, a handful of entries is mostly headings.
 */
export const GROUP_THRESHOLD = 8;
