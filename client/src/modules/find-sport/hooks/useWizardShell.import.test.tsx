// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  search: "",
  players: [] as Array<Record<string, unknown>>,
  addChild: vi.fn(),
  updateChild: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => {
      m.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    },
    replace: (url: string) => {
      m.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    },
  }),
  usePathname: () => "/assessment/discover",
  useSearchParams: () => new URLSearchParams(m.search),
}));
vi.mock("@/lib/api/axios", () => ({
  default: {
    get: vi.fn(async () => ({ data: { success: true, data: m.players } })),
    post: vi.fn(async () => ({ data: { success: true } })),
  },
}));
vi.mock("@/modules/auth/store/authStore", () => ({ useAuthStore: () => ({ token: "t" }) }));
vi.mock("@/modules/auth/hooks/useProfile", () => ({ useRefreshProfile: () => vi.fn() }));
vi.mock("@/modules/player/hooks/useSaveChild", () => ({
  useSaveChild: () => ({ addChild: m.addChild, updateChild: m.updateChild }),
}));

import { EMPTY_ANSWERS } from "../types";
import { useWizardShell } from "./useWizardShell";

const aarav = {
  _id: "a",
  name: "Aarav Sharma",
  dob: "2016-05-10",
  quiz: { energyType: "endurance" },
};
const riya = { _id: "r", name: "Riya Sharma", dob: "2019-02-01" };

/** A quiz finished while logged out, for "Riya", kept in localStorage. */
function storeGuestSession() {
  localStorage.setItem(
    "pms_wizard_results",
    JSON.stringify({
      answers: {
        ...EMPTY_ANSWERS,
        childName: "Riya",
        age: 7,
        energyType: "explosive",
        ambition: "fun",
        budget: "under-3k",
        weeklyHours: "1-3",
      },
      savedAt: new Date().toISOString(),
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  m.search = "";
  m.addChild.mockReset().mockResolvedValue({ child: { _id: "new" } });
  m.updateChild.mockReset().mockResolvedValue({});
});

describe("useWizardShell: results from a logged-out session, parent has children", () => {
  it("keeps the results unsaved instead of dropping them, and suggests the matching child", async () => {
    m.players = [aarav, riya];
    storeGuestSession();
    const { result } = renderHook(() => useWizardShell());

    await waitFor(() => expect(result.current.savedStatus).toBe("unsaved"));
    expect(result.current.suggestedChildId).toBe("r");
    expect(m.addChild).not.toHaveBeenCalled();
    expect(m.updateChild).not.toHaveBeenCalled();
  });

  it("does not swap the restored answers for the only child's saved ones", async () => {
    m.players = [aarav];
    storeGuestSession();
    const { result } = renderHook(() => useWizardShell());

    await waitFor(() => expect(result.current.savedStatus).toBe("unsaved"));
    expect(result.current.answers.childName).toBe("Riya");
    expect(result.current.answers.energyType).toBe("explosive");
  });

  it("saves to the child the parent picks, then forgets the logged-out copy", async () => {
    m.players = [aarav, riya];
    storeGuestSession();
    const { result } = renderHook(() => useWizardShell());
    await waitFor(() => expect(result.current.savedStatus).toBe("unsaved"));

    let ok = false;
    await act(async () => {
      ok = await result.current.saveResultsTo("r");
    });

    expect(ok).toBe(true);
    expect(m.updateChild).toHaveBeenCalledWith(
      "r",
      expect.objectContaining({ budgetRange: "under-3k", weeklyHoursCategory: "1-3" })
    );
    expect(result.current.savedStatus).toBe("saved");
    expect(localStorage.getItem("pms_wizard_results")).toBeNull();
  });

  it("creates a new child when the parent says so", async () => {
    m.players = [aarav];
    storeGuestSession();
    const { result } = renderHook(() => useWizardShell());
    await waitFor(() => expect(result.current.savedStatus).toBe("unsaved"));

    await act(async () => {
      await result.current.saveResultsTo(null);
    });

    expect(m.addChild).toHaveBeenCalledWith(expect.objectContaining({ name: "Riya" }));
    expect(m.updateChild).not.toHaveBeenCalled();
  });

  it("stays unsaved and reports failure when the save fails", async () => {
    m.players = [aarav];
    storeGuestSession();
    m.updateChild.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useWizardShell());
    await waitFor(() => expect(result.current.savedStatus).toBe("unsaved"));

    let ok = true;
    await act(async () => {
      ok = await result.current.saveResultsTo("a");
    });
    expect(ok).toBe(false);
    expect(result.current.savedStatus).toBe("unsaved");
    expect(localStorage.getItem("pms_wizard_results")).not.toBeNull();
  });
});
