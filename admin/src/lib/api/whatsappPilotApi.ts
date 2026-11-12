import axiosInstance from "./axios";

export type WhatsAppPilotMode = "listed" | "everyone";

export interface WhatsAppPilotEntry {
  id: string;
  label: string;
  lastFour: string;
  createdAt: string;
}

export interface WhatsAppPilotState {
  mode: WhatsAppPilotMode;
  numbers: WhatsAppPilotEntry[];
  assistantOn: boolean;
  envListCount: number;
}

export interface AddNumbersResult {
  added: number;
  alreadyListed: number;
  invalid: string[];
}

export type FollowUpStatus = "none" | "new" | "reviewing" | "contacted" | "done";
export type AssistanceKind = "coach" | "tournaments" | "expert" | "team" | "other";
export type EnquiryCategory =
  | "sport"
  | "start"
  | "coaching"
  | "tournaments"
  | "pathway"
  | "scholarships"
  | "admissions"
  | "fitness"
  | "other";
export type AnsweredBy = "assistant" | "team" | "pending";
export type EnquiryFeedback = "helpful" | "not_helpful";

export interface EnquiryTurn {
  at: string;
  /** What the parent said (or what was heard from a voice note, or a label for a photo). */
  parent: string;
  /** What the assistant answered. */
  assistant: string;
}

export interface TeamMessage {
  at: string;
  text: string;
  /** "text" inside WhatsApp's 24-hour window, "template" outside it. */
  via: "text" | "template";
  /** The admin who sent it. */
  by?: string;
}

export interface WhatsAppEnquiry {
  id: string;
  reference: string;
  parentRef: string;
  question: string;
  childAge?: number;
  sport?: string;
  level?: string;
  city?: string;
  objective?: string;
  playingContext?: string;
  /** What the request is about. Absent on enquiries from before the adaptive questions. */
  category?: EnquiryCategory;
  /** Who answered it: the assistant or the team. */
  answeredBy?: AnsweredBy;
  /** When the parent confirmed the summary. */
  confirmedAt?: string;
  /** When the team's reply is due: 24 hours after confirming, while it is still waiting. */
  replyDueAt?: string;
  guidance?: string;
  /** Every exchange, oldest first. Only on a single enquiry, not in the list. */
  turns?: EnquiryTurn[];
  /** What the team sent from the panel. Only on a single enquiry, like `turns`. */
  teamMessages?: TeamMessage[];
  assistance: AssistanceKind[];
  followUpStatus: FollowUpStatus;
  followUpSummary?: string;
  ticketId?: string;
  /** True when a number is kept (every enquiry since numbers were kept on all of them). */
  hasContact: boolean;
  feedback?: EnquiryFeedback;
  closed: boolean;
  teamNote?: string;
  turnCount: number;
  createdAt: string;
  lastMessageAt: string;
}

export interface EnquiryFilters {
  status?: string;
  sport?: string;
  assistance?: string;
  category?: string;
  answeredBy?: string;
  feedback?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface EnquiryList {
  rows: WhatsAppEnquiry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EnquirySummary {
  enquiries: number;
  parents: number;
  needsFollowUp: number;
  asksForTeam: number;
  /** Waiting for the team for more than the 24 hours promised. */
  overdue: number;
  feedback: { helpful: number; notHelpful: number };
  byFollowUp: Record<string, number>;
  byAssistance: Record<string, number>;
  byCategory: Record<string, number>;
  byAnsweredBy: Record<string, number>;
  bySport: Array<{ sport: string; count: number }>;
}

/** Drops empty filters, so the query string only carries what is set. */
const queryOf = (filters: EnquiryFilters, extra: Record<string, string | number> = {}) => {
  const params: Record<string, string | number> = { ...extra };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }
  return params;
};

export const whatsappPilotApi = {
  listEnquiries: async (filters: EnquiryFilters, page: number, limit = 25) => {
    const res = await axiosInstance.get<{ success: boolean; data: EnquiryList }>(
      "/admin/whatsapp-pilot/enquiries",
      { params: queryOf(filters, { page, limit }) }
    );
    return res.data.data;
  },

  enquirySummary: async () => {
    const res = await axiosInstance.get<{ success: boolean; data: EnquirySummary }>(
      "/admin/whatsapp-pilot/enquiries/summary"
    );
    return res.data.data;
  },

  getEnquiry: async (id: string) => {
    const res = await axiosInstance.get<{ success: boolean; data: WhatsAppEnquiry }>(
      `/admin/whatsapp-pilot/enquiries/${id}`
    );
    return res.data.data;
  },

  updateEnquiry: async (
    id: string,
    changes: { followUpStatus?: FollowUpStatus; teamNote?: string }
  ) => {
    const res = await axiosInstance.patch<{ success: boolean; data: WhatsAppEnquiry }>(
      `/admin/whatsapp-pilot/enquiries/${id}`,
      changes
    );
    return res.data.data;
  },

  revealContact: async (id: string) => {
    const res = await axiosInstance.post<{ success: boolean; data: { phone: string } }>(
      `/admin/whatsapp-pilot/enquiries/${id}/reveal-contact`
    );
    return res.data.data.phone;
  },

  /** Sends the parent a message from the PowerMySport WhatsApp number. Returns the updated enquiry. */
  sendReply: async (id: string, text: string) => {
    const res = await axiosInstance.post<{ success: boolean; data: WhatsAppEnquiry }>(
      `/admin/whatsapp-pilot/enquiries/${id}/reply`,
      { text }
    );
    return res.data.data;
  },

  /** The server builds the CSV and logs the export, so the file is fetched, not built here. */
  exportEnquiries: async (filters: EnquiryFilters) => {
    const res = await axiosInstance.get<Blob>("/admin/whatsapp-pilot/enquiries/export.csv", {
      params: queryOf(filters),
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "whatsapp-enquiries.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  get: async () => {
    const res = await axiosInstance.get<{ success: boolean; data: WhatsAppPilotState }>(
      "/admin/whatsapp-pilot"
    );
    return res.data.data;
  },

  addNumbers: async (text: string) => {
    const res = await axiosInstance.post<{ success: boolean; data: AddNumbersResult }>(
      "/admin/whatsapp-pilot/numbers",
      { text }
    );
    return res.data.data;
  },

  removeNumber: async (id: string) => {
    await axiosInstance.delete(`/admin/whatsapp-pilot/numbers/${id}`);
  },

  setMode: async (mode: WhatsAppPilotMode) => {
    await axiosInstance.put("/admin/whatsapp-pilot/mode", { mode });
  },
};
