// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Dependent } from "@/types";
import DependentManagementModal from "./DependentManagementModal";

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/sports/services/sports", () => ({
  sportsApi: {
    getAllSports: async () => [{ name: "Tennis" }, { name: "Badminton" }, { name: "Squash" }],
  },
}));

const child = { _id: "c1", name: "Riya", dob: "2016-06-01", gender: "FEMALE" } as Dependent;

const open = (
  onSubmit = vi.fn().mockResolvedValue(undefined),
  initialDependent: Dependent = child
) => {
  render(
    <DependentManagementModal
      isOpen
      onClose={() => undefined}
      onSubmit={onSubmit}
      initialDependent={initialDependent}
    />
  );
  return onSubmit;
};

// Walking the steps once saved the profile at the end of step 2: the Continue button and the
// Save changes button sit in the same place, so React reused one button and switched its type
// to "submit" while the click that moved to step 3 was still being handled, and the browser
// then submitted the form. Step 3 (goal, budget, time) could not be reached by Continue.
describe("the edit-profile dialog", () => {
  it("moves through the steps without saving until Save changes", () => {
    const onSubmit = open();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/step 3 of 3/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeTruthy();
  });

  it("saves when Save changes is pressed on the last step", async () => {
    const onSubmit = open();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("uses a different button for Save changes than for Continue", () => {
    // The cause of the bug: one DOM button was reused and its type flipped to "submit" in the
    // middle of the click that moved to the last step. jsdom cannot replay that exactly (it
    // applies the update after the click), so this pins the cause: they must be two elements.
    open();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    const continueButton = screen.getByRole("button", { name: /continue/i });

    fireEvent.click(continueButton);
    const saveButton = screen.getByRole("button", { name: /save changes/i });

    expect(saveButton).not.toBe(continueButton);
    expect(continueButton.isConnected).toBe(false);
  });

  describe("the sport", () => {
    const toSportStep = () => fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    it("is one field, showing the sport the child plays and not a stale list", async () => {
      // Jatin's old shape: committed to Badminton, list says Tennis.
      open(vi.fn(), { ...child, chosenSport: "Badminton", sportsFocus: ["Tennis"] });
      toSportStep();

      const chosen = await screen.findByRole("list", { name: /selected sports/i });
      expect(chosen.textContent).toContain("Badminton");
      expect(chosen.textContent).not.toContain("Tennis");
    });

    it("shows the first entry of an old list for a child with no chosen sport", async () => {
      open(vi.fn(), { ...child, sportsFocus: ["Squash", "Tennis"] });
      toSportStep();

      expect((await screen.findByRole("list", { name: /selected sports/i })).textContent).toBe(
        "Squash"
      );
    });

    it("replaces the sport when another is picked, and saves it without the old list", async () => {
      const onSubmit = open(vi.fn().mockResolvedValue(undefined), {
        ...child,
        chosenSport: "Badminton",
        sportsFocus: ["Badminton"],
      });
      toSportStep();

      fireEvent.focus(await screen.findByRole("combobox", { name: /search or add sports/i }));
      fireEvent.click(await screen.findByRole("button", { name: "Tennis" }));
      expect(screen.getByRole("list", { name: /selected sports/i }).textContent).toBe("Tennis");

      toSportStep();
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const sent = onSubmit.mock.calls[0]![0];
      expect(sent.chosenSport).toBe("Tennis");
      expect("sportsFocus" in sent).toBe(false);
    });

    it("clears the sport when it is removed", async () => {
      const onSubmit = open(vi.fn().mockResolvedValue(undefined), {
        ...child,
        chosenSport: "Tennis",
      });
      toSportStep();
      fireEvent.click(await screen.findByRole("button", { name: "Remove Tennis" }));
      toSportStep();
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]![0].chosenSport).toBe("");
    });
  });
});
