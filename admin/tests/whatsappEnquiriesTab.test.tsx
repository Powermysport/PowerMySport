// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppEnquiry } from "@/lib/api/whatsappPilotApi";

const { listEnquiries, getEnquiry } = vi.hoisted(() => ({
  listEnquiries: vi.fn(),
  getEnquiry: vi.fn(),
}));

vi.mock("@/lib/api/whatsappPilotApi", () => ({
  whatsappPilotApi: {
    listEnquiries,
    getEnquiry,
    updateEnquiry: vi.fn(),
    revealContact: vi.fn(),
    sendReply: vi.fn(),
    exportEnquiries: vi.fn(),
  },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { EnquiriesTab } from "@/modules/whatsapp-pilot/components/EnquiriesTab";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-12T10:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const enquiry = (extra: Partial<WhatsAppEnquiry>): WhatsAppEnquiry => ({
  id: "id",
  reference: "PMS-AAAAA",
  parentRef: "p-1",
  question: "My son plays tennis and wants to start AITA tournaments",
  assistance: [],
  followUpStatus: "none",
  hasContact: true,
  closed: false,
  turnCount: 3,
  createdAt: iso(NOW - 5 * HOUR),
  lastMessageAt: iso(NOW - HOUR),
  ...extra,
});

const ROWS: WhatsAppEnquiry[] = [
  enquiry({
    id: "a",
    reference: "PMS-NEW01",
    category: "tournaments",
    answeredBy: "team",
    followUpStatus: "new",
    confirmedAt: iso(NOW - 19 * HOUR),
    replyDueAt: iso(NOW + 5 * HOUR),
    playingContext: "Plays club tournaments",
    sport: "Tennis",
    childAge: 13,
  }),
  enquiry({
    id: "b",
    reference: "PMS-LATE2",
    category: "scholarships",
    answeredBy: "team",
    followUpStatus: "new",
    confirmedAt: iso(NOW - 26 * HOUR - 30 * 60 * 1000),
    replyDueAt: iso(NOW - 2 * HOUR - 30 * 60 * 1000),
  }),
  enquiry({
    id: "c",
    reference: "PMS-REV03",
    category: "admissions",
    answeredBy: "team",
    followUpStatus: "reviewing",
    confirmedAt: iso(NOW - 2 * HOUR),
    replyDueAt: iso(NOW + 22 * HOUR),
  }),
  enquiry({
    id: "d",
    reference: "PMS-AI004",
    category: "sport",
    answeredBy: "assistant",
    followUpStatus: "none",
    confirmedAt: iso(NOW - 2 * HOUR),
  }),
  enquiry({
    id: "e",
    reference: "PMS-OLD05",
    assistance: ["coach"],
    followUpStatus: "contacted",
  }),
];

const rowFor = (reference: string) => screen.getByText(reference).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  listEnquiries.mockResolvedValue({ rows: ROWS, total: ROWS.length, page: 1, totalPages: 1 });
  getEnquiry.mockImplementation(async (id: string) => ({
    ...ROWS.find((r) => r.id === id),
    turns: [],
    teamMessages: [],
  }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("the enquiries screen", () => {
  it("shows each request's topic, who answered it, its status in the team's words, and its due time", async () => {
    render(<EnquiriesTab />);
    await screen.findByText("PMS-NEW01");

    const fresh = within(rowFor("PMS-NEW01"));
    expect(fresh.getByText("Tournaments")).toBeInTheDocument();
    expect(fresh.getByText("Team")).toBeInTheDocument();
    expect(fresh.getByText("New")).toBeInTheDocument();
    expect(fresh.getByText("Due in 5h")).toBeInTheDocument();

    const late = within(rowFor("PMS-LATE2"));
    expect(late.getByText("Scholarships")).toBeInTheDocument();
    const overdue = late.getByText("Overdue by 2h 30m");
    expect(overdue.className).toMatch(/red/);

    const reviewing = within(rowFor("PMS-REV03"));
    expect(reviewing.getByText("School and college entry")).toBeInTheDocument();
    expect(reviewing.getByText("Under review")).toBeInTheDocument();

    const answered = within(rowFor("PMS-AI004"));
    expect(answered.getAllByText("AI answered").length).toBeGreaterThanOrEqual(1);
    expect(answered.queryByText(/Due in|Overdue/)).not.toBeInTheDocument();

    // An older enquiry with no category still says what was asked for, and uses the new words.
    const older = within(rowFor("PMS-OLD05"));
    expect(older.getByText("Coach or academy")).toBeInTheDocument();
    expect(older.getByText("Responded")).toBeInTheDocument();
  });

  it("offers the new statuses and topics as filters, in the team's words", async () => {
    render(<EnquiriesTab />);
    await screen.findByText("PMS-NEW01");

    const status = screen.getByLabelText("Status") as HTMLSelectElement;
    expect([...status.options].map((o) => o.text)).toEqual([
      "Any status",
      "New",
      "Under review",
      "Responded",
      "Closed",
      "No team follow-up",
    ]);
    const topic = screen.getByLabelText("Topic") as HTMLSelectElement;
    const topics = [...topic.options].map((o) => o.text);
    expect(topics).toContain("Scholarships");
    expect(topics).toContain("School and college entry");
    expect(topics).toContain("Fitness and sports support");
    const by = screen.getByLabelText("Answered by") as HTMLSelectElement;
    expect([...by.options].map((o) => o.text)).toEqual(["Anyone", "AI answered", "Team"]);
  });

  it("asks the server for the topic and who answered, and nothing else added", async () => {
    render(<EnquiriesTab />);
    await screen.findByText("PMS-NEW01");

    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "scholarships" } });
    await waitFor(() =>
      expect(listEnquiries).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "scholarships" }),
        1
      )
    );
    fireEvent.change(screen.getByLabelText("Answered by"), { target: { value: "assistant" } });
    await waitFor(() =>
      expect(listEnquiries).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "scholarships", answeredBy: "assistant" }),
        1
      )
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "reviewing" } });
    await waitFor(() =>
      expect(listEnquiries).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "reviewing" }),
        1
      )
    );
  });

  it("shows the request's details in the drawer and lets the team set under review", async () => {
    render(<EnquiriesTab />);
    fireEvent.click(await screen.findByText("PMS-NEW01"));

    expect(await screen.findByText("Playing context")).toBeInTheDocument();
    expect(screen.getByText("Plays club tournaments")).toBeInTheDocument();
    expect(screen.getByText("Team reply due")).toBeInTheDocument();
    expect(screen.getByText("Confirmed by the parent")).toBeInTheDocument();

    const buttons = ["New", "Under review", "Responded", "Closed"].map((name) =>
      screen.getAllByRole("button", { name }).at(-1)
    );
    expect(buttons.every(Boolean)).toBe(true);
    // The one it is already on cannot be pressed again; the others can.
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
  });
});
