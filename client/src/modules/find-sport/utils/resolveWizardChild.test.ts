import { describe, expect, it } from "vitest";
import { resolveWizardChild } from "./resolveWizardChild";

const aarav = { _id: "a", name: "Aarav Sharma", dob: "2016-05-10" };
const riya = { _id: "r", name: "Riya Sharma", dob: "2018-02-01" };
const kids = [aarav, riya];

describe("resolveWizardChild", () => {
  it("keeps the selected child when the pre-filled first name is unchanged", () => {
    expect(resolveWizardChild(kids, "a", "Aarav")).toEqual({ kind: "keep" });
    expect(resolveWizardChild(kids, "a", "  aarav sharma ")).toEqual({ kind: "keep" });
  });

  it("switches to the sibling when the parent types the sibling's name over the selected child", () => {
    // The bug: this used to keep "a" selected and overwrite Aarav with Riya's answers.
    expect(resolveWizardChild(kids, "a", "Riya")).toEqual({ kind: "switch", child: riya });
  });

  it("drops the selection when the typed name is a child we do not have yet", () => {
    expect(resolveWizardChild(kids, "a", "Kabir")).toEqual({ kind: "new" });
  });

  it("selects an existing child by name when nothing was selected, instead of adding a duplicate", () => {
    expect(resolveWizardChild(kids, null, "riya sharma")).toEqual({ kind: "switch", child: riya });
  });

  it("leaves a guest or a brand-new child alone", () => {
    expect(resolveWizardChild([], null, "Kabir")).toEqual({ kind: "keep" });
    expect(resolveWizardChild(kids, null, "Kabir")).toEqual({ kind: "keep" });
  });

  it("does not guess between two children who share a first name", () => {
    const twins = [aarav, { _id: "b", name: "Aarav Mehta", dob: "2016-05-10" }];
    expect(resolveWizardChild(twins, "b", "Aarav")).toEqual({ kind: "keep" });
    expect(resolveWizardChild(twins, null, "Aarav")).toEqual({ kind: "keep" });
  });

  it("ignores an empty name", () => {
    expect(resolveWizardChild(kids, "a", "   ")).toEqual({ kind: "keep" });
  });
});
