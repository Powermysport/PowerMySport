// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Next's router navigates asynchronously: a push lands AFTER React has rendered the state
// changes made in the same handler. This mock reproduces that by holding pushes until
// `flushPush()`, while `replace` (the flow's clamp) applies at once.
const nav = vi.hoisted(() => {
  const state = { search: "", pending: null as string | null };
  const apply = (url: string) => {
    state.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  };
  return {
    state,
    push: vi.fn((url: string) => {
      state.pending = url;
    }),
    replace: vi.fn((url: string) => apply(url)),
    flushPush: () => {
      if (state.pending !== null) apply(state.pending);
      state.pending = null;
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/assessment/discover",
  useSearchParams: () => new URLSearchParams(nav.state.search),
}));
vi.mock("@/lib/api/axios", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/modules/auth/store/authStore", () => ({
  useAuthStore: () => ({ token: null, hydrated: true }),
}));
vi.mock("@/modules/auth/hooks/useProfile", () => ({ useRefreshProfile: () => vi.fn() }));
vi.mock("@/modules/player/hooks/useSaveChild", () => ({
  useSaveChild: () => ({ addChild: vi.fn(), updateChild: vi.fn() }),
}));

import { STEPS } from "../components/wizard/wizardSteps";
import { useWizardShell } from "./useWizardShell";

const RESULTS_STEP = STEPS.length; // 1-based: the last step is the results

beforeEach(() => {
  localStorage.clear();
  nav.state.search = "";
  nav.state.pending = null;
  nav.push.mockClear();
  nav.replace.mockClear();
});

/** A finished quiz sitting on the results page. */
function onResults() {
  const hook = renderHook(() => useWizardShell());
  act(() => hook.result.current.setAnswer("weeklyHours", "4-7"));
  act(() => {
    nav.state.search = `?step=${RESULTS_STEP}`;
  });
  hook.rerender();
  nav.replace.mockClear();
  return hook;
}

describe("useWizardShell retake", () => {
  it("goes back to the start instead of being clamped to the last question", () => {
    const { result, rerender } = onResults();
    expect(result.current.currentStep.kind).toBe("results");

    act(() => result.current.retake());
    // Before the push lands, the cleared answers must not trip the flow's completion clamp,
    // which used to `replace` the URL with the last question and win over the push.
    expect(nav.replace).not.toHaveBeenCalled();

    act(() => nav.flushPush());
    rerender();
    // A guest's start is the name screen: the welcome splash is skipped for guests (F4).
    expect(result.current.currentStep.kind).toBe("name");
    expect(result.current.answers.weeklyHours).toBeNull();
    expect(result.current.answers.childName).toBe("");
  });

  it("still keeps an unfinished quiz out of the results once the retake has landed", () => {
    const { result, rerender } = onResults();
    act(() => result.current.retake());
    act(() => nav.flushPush());
    rerender();

    // A hand-typed results URL after the retake is clamped as usual.
    act(() => {
      nav.state.search = `?step=${RESULTS_STEP}`;
    });
    rerender();
    expect(nav.replace).toHaveBeenCalled();
    expect(result.current.currentStep.kind).not.toBe("results");
  });
});
