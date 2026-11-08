"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api/axios";
import { useFlow } from "@/flow/useFlow";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useRefreshProfile } from "@/modules/auth/hooks/useProfile";
import { useSaveChild } from "@/modules/player/hooks/useSaveChild";
import { trackGuest } from "@/modules/analytics/services/guestTracking";
import type { PlayerProfile } from "@/modules/guidance/types";
import type { SavedStatus, WizardAnswers } from "../types";
import { EMPTY_ANSWERS } from "../types";
import type { SportFitResult, SportResult } from "../types";
import { scoreChosenSports, scoreSports } from "../utils/scorer";
import { buildDependentPayload, prefillFromPlayer } from "../utils/dependentMapping";
import { resolveWizardChild } from "../utils/resolveWizardChild";
import {
  ASSESSMENT_FLOW,
  SECTION_META,
  STEPS,
  getProfileChips,
  questionProgress,
} from "../components/wizard/wizardSteps";
import { firstNoteFor, scheduleTrialCheckIn, trialSignals } from "../components/wizard/wizardTrial";

export function useWizardShell() {
  const { token, hydrated } = useAuthStore();
  const refreshProfile = useRefreshProfile();
  const { addChild, updateChild } = useSaveChild();
  // A dashboard "Find their sport" card links here with ?dependentId=<id> so
  // the wizard knows up front who this assessment is for. Without it, the
  // dependent picker below defaults to nothing selected, and finishing the
  // assessment creates a brand-new child profile instead of updating the one
  // the parent came from — the completed assessment then lands nowhere near
  // the card that started it.
  const searchParams = useSearchParams();
  const targetDependentId = searchParams.get("dependentId");
  const [answers, setAnswers] = useState<WizardAnswers>({ ...EMPTY_ANSWERS });
  // Scores are a pure function of the answers, so they are derived, not stored.
  // Previously they lived in state and were populated by the `processing` step's
  // effect, which meant the results only existed once that effect had run —
  // fine for the linear flow, but it made the results step impossible to reach
  // from a URL (a deep link would render an empty report). Deriving them makes
  // the results a function of context, which is the prerequisite for putting
  // this wizard's step in the URL. The persistence side-effects (save to the
  // API, localStorage, trial check-in) stay in the processing effect below —
  // only the computation moved.
  const results = useMemo(() => scoreSports(answers), [answers]);
  const chosenFits = useMemo(() => scoreChosenSports(answers), [answers]);

  // The active step lives in the URL (?step=): Back walks the questionnaire
  // instead of leaving it, refresh keeps your place, and each step is linkable
  // for drop-off analytics. `goNext`/`goBack` below are this flow's next/back,
  // so every existing call site (question auto-advance, transitions, the
  // processing screen's auto-advance) is unchanged. Completion = the last
  // question answered; see ASSESSMENT_FLOW.
  // Child profile selection
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);

  const flow = useMemo(() => ASSESSMENT_FLOW, []);
  const [retaking, setRetaking] = useState(false);
  const {
    index: stepIndex,
    direction,
    next: goNext,
    back: goBack,
    goToStep,
  } = useFlow(flow, {
    completed: retaking || answers.weeklyHours != null,
    age: answers.age,
    // Unknown until the auth store hydrates. Treating "not read yet" as a guest skipped the
    // welcome (whose child picker is the logged-in parent's first step) and the clamp then
    // replaced the URL with the name screen for good. resolveStep moves a real guest on.
    guest: hydrated && !token,
    knownChild:
      selectedDependentId !== null && !!answers.dob && !!answers.gender && !!answers.state,
  });

  // A retake clears the answers and moves to the start in one handler, but the router's move
  // lands a render later. In between, the flow sees "on the results, quiz not finished" and its
  // clamp replaced the URL with the last question, beating the move (audit F16). `retaking`
  // holds the gate open until the start is reached (the welcome, or the name screen for a
  // guest, whose welcome is skipped); cleared by adjusting state during render, the same
  // pattern useFlow uses for `direction`.
  if (retaking && stepIndex <= 1) setRetaking(false);
  const [nameInput, setNameInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  // The sport the parent explicitly committed to on the results page — the one
  // decision this flow captures, as opposed to everything we infer from scores.
  const [chosenSport, setChosenSport] = useState<string | null>(null);
  const [choosingSport, setChoosingSport] = useState(false);
  // Holds wizard data to auto-import once we confirm the user has no children yet
  const pendingImport = useRef<{
    answers: WizardAnswers;
    scored: SportResult[];
    chosen: SportFitResult[];
    chosenSport?: string;
  } | null>(null);

  const [savedStatus, setSavedStatus] = useState<SavedStatus>("idle");
  const [savedForName, setSavedForName] = useState<string | undefined>(undefined);

  // Restore wizard session from localStorage on mount (works for both guests and
  // newly-registered users who filled the wizard before signing up).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pms_wizard_results");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        answers: WizardAnswers;
        savedAt: string;
        chosenSport?: string;
      };
      if (Date.now() - new Date(saved.savedAt).getTime() > 24 * 60 * 60 * 1000) return;
      if (!saved.answers) return;

      const restored = { ...EMPTY_ANSWERS, ...saved.answers };
      setAnswers(restored);
      if (restored.childName) setNameInput(restored.childName);
      const scored = scoreSports(restored);
      const chosen = scoreChosenSports(restored);
      if (scored.length === 0 && chosen.length === 0) return;
      if (saved.chosenSport) setChosenSport(saved.chosenSport);
      goToStep(STEPS.length);

      // Queued whether or not a token is known yet: on a full page load the auth store is
      // still hydrating when this runs (HydrationBoundary's effect fires after ours), so
      // gating on `token` here dropped a logged-in parent's results with no prompt and no
      // save. The players fetch, which re-runs once the token arrives, decides what happens:
      // create the child for a new account, or ask an existing parent whose results these are.
      pendingImport.current = {
        answers: restored,
        scored,
        chosen,
        // A sport picked as a guest has nowhere to live until the dependent
        // exists — it rides in on creation rather than being lost at signup.
        ...(saved.chosenSport ? { chosenSport: saved.chosenSport } : {}),
      };
      if (token) setSavedStatus("saving");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch full player profiles on mount (for pre-fill with wizard fields).
  // Also handles the post-registration auto-import: if the user has no children
  // yet and pendingImport holds their guest wizard session, create the child now.
  useEffect(() => {
    if (!token) return;
    api
      .get<{ success: boolean; data: PlayerProfile[] }>("/auth/players")
      .then((res) => {
        if (!res.data.success || !Array.isArray(res.data.data)) return;
        const dependents = res.data.data;
        setPlayers(dependents);

        if (dependents.length === 0 && pendingImport.current) {
          // Newly registered user — create child profile from their guest session
          const { answers: a, scored, chosen, chosenSport: pickedSport } = pendingImport.current;
          pendingImport.current = null;
          const childName = a.childName?.trim() || "My Child";
          addChild({
            name: childName,
            ...buildDependentPayload(a, scored, childName, chosen, pickedSport),
          })
            .then(({ child }) => {
              if (child?._id) setSelectedDependentId(child._id);
              setSavedForName(childName);
              setSavedStatus("saved");
              try {
                localStorage.removeItem("pms_wizard_results");
              } catch {}
            })
            .catch(() => setSavedStatus("error"));
        } else if (pendingImport.current) {
          // Existing parent who took the quiz logged out. These results used to be dropped
          // without a word (audit F13). Keep them on screen, unsaved, and let the parent say
          // which child they belong to; the restored answers must not be replaced by a
          // child's pre-fill, or the page would show someone else's report.
          setSavedStatus("unsaved");
        } else {
          // A dependent named in the URL wins over the single-child heuristic
          // below — that heuristic exists for the case where the parent typed
          // this URL by hand with no target in mind, not to override a card
          // that already told us who this is for.
          const targeted = targetDependentId
            ? dependents.find((p) => p._id === targetDependentId)
            : undefined;
          if (targeted) {
            setSelectedDependentId(targeted._id);
            applyPlayer(targeted);
          } else if (dependents.length === 1) {
            // Auto-select the only dependent for pre-fill
            setSelectedDependentId(dependents[0]._id);
            applyPlayer(dependents[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function applyPlayer(player: PlayerProfile) {
    const prefilled = prefillFromPlayer(player);
    const firstName = player.name?.split(" ")[0] ?? "";
    if (firstName) {
      setNameInput(firstName);
      prefilled.childName = firstName;
    }
    setAnswers((prev) => ({ ...prev, ...prefilled }));
    // Carry the last decision forward on a retake — they can change it on any
    // card, but it shouldn't silently reset to "no sport picked".
    setChosenSport(player.chosenSport ?? null);
  }

  function selectDependent(player: PlayerProfile) {
    if (selectedDependentId === player._id) {
      // Deselect — reset to empty
      startNewChild();
    } else {
      setSelectedDependentId(player._id);
      applyPlayer(player);
    }
  }

  /** Clears the selection back to a blank profile — "Someone new" / deselect. */
  function startNewChild() {
    setSelectedDependentId(null);
    setAnswers({ ...EMPTY_ANSWERS });
    setNameInput("");
    setChosenSport(null);
  }

  const currentStep = STEPS[stepIndex];
  const progress = questionProgress(stepIndex);
  const showProgress = currentStep.kind !== "welcome" && currentStep.kind !== "results";
  // A guest's quiz opens on the name screen (the welcome is skipped), so there is nothing
  // to go back to there.
  const firstVisibleStep = stepIndex === 0 || (currentStep.kind === "name" && !token);
  const showBack =
    !firstVisibleStep && currentStep.kind !== "processing" && currentStep.kind !== "results";
  const isFullScreen =
    currentStep.kind === "welcome" ||
    currentStep.kind === "results" ||
    currentStep.kind === "processing";

  // Derive current section for the left panel
  const currentSection: string = (() => {
    if (currentStep.kind === "question") {
      const sectionMap: Record<string, string> = {
        dob: "Child",
        state: "Child",
        priorSports: "Child",
        height: "Physical",
        weight: "Physical",
        energyType: "Physical",
        visualTracking: "Physical",
        eyesight: "Physical",
        agility: "Physical",
        teamIndividual: "Personality",
        focusStyle: "Personality",
        decisionStyle: "Personality",
        pressureResponse: "Personality",
        contactComfort: "Comfort",
        budget: "Practical",
        ambition: "Practical",
        weeklyHours: "Practical",
      };
      return sectionMap[currentStep.questionKey] ?? "";
    }
    if (currentStep.kind === "name") return "Child";
    return "";
  })();

  const profileChips = getProfileChips(answers);
  const sectionMeta = SECTION_META[currentSection];

  const setAnswer = <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * The name screen's Continue. The name is editable even when a child is pre-selected, so it
   * decides which child the answers are saved to: typing a sibling's name used to keep the
   * first child selected and overwrite it with the sibling's answers (audit F11).
   */
  const confirmName = (typed: string) => {
    const name = typed.trim();
    if (!name) return;
    const resolution = resolveWizardChild(players, selectedDependentId, name);
    if (resolution.kind === "switch") {
      setSelectedDependentId(resolution.child._id);
      applyPlayer(resolution.child);
    } else if (resolution.kind === "new") {
      // Everything pre-filled came from the child we just moved away from, except the
      // boy/girl answer, which the parent gives on this same screen.
      setSelectedDependentId(null);
      setAnswers((prev) => ({ ...EMPTY_ANSWERS, gender: prev.gender }));
      setChosenSport(null);
    }
    setNameInput(name);
    setAnswer("childName", name);
    goNext();
  };

  /** For unsaved results: the existing child the quiz's name points at, offered first. */
  const suggestedChildId: string | null = (() => {
    if (savedStatus !== "unsaved") return null;
    const r = resolveWizardChild(players, null, answers.childName);
    return r.kind === "switch" ? (r.child._id ?? null) : null;
  })();

  /**
   * Saves results brought back from a logged-out session to the child the parent picked, or
   * to a new child when `childId` is null (audit F13).
   */
  const saveResultsTo = async (childId: string | null): Promise<boolean> => {
    const pending = pendingImport.current;
    if (!pending) return false;
    setSavedStatus("saving");
    const { answers: a, scored, chosen, chosenSport: pickedSport } = pending;
    try {
      if (childId) {
        const child = players.find((p) => p._id === childId);
        const name = child?.name.split(" ")[0] ?? a.childName;
        await updateChild(
          childId,
          buildDependentPayload(a, scored, undefined, chosen, pickedSport)
        );
        setSelectedDependentId(childId);
        setSavedForName(name);
      } else {
        const name = a.childName?.trim() || "My Child";
        const { child } = await addChild({
          name,
          ...buildDependentPayload(a, scored, name, chosen, pickedSport),
        });
        if (child?._id) setSelectedDependentId(child._id);
        setSavedForName(name);
      }
      pendingImport.current = null;
      setSavedStatus("saved");
      try {
        localStorage.removeItem("pms_wizard_results");
      } catch {}
      void refreshProfile();
      return true;
    } catch {
      setSavedStatus("unsaved");
      return false;
    }
  };

  /** The existing child the typed name will save to, if any (logged-in parents only). */
  const nameTargetChild: PlayerProfile | undefined = (() => {
    const typed = nameInput.trim();
    if (!token || players.length === 0 || !typed) return undefined;
    const r = resolveWizardChild(players, selectedDependentId, typed);
    if (r.kind === "switch") return r.child;
    if (r.kind === "keep") return players.find((p) => p._id === selectedDependentId);
    return undefined;
  })();

  /** Tells a logged-in parent which profile the typed name will save to, before they continue. */
  const nameTarget: string | null =
    !nameInput.trim() || !token || players.length === 0
      ? null
      : nameTargetChild
        ? `Saves to ${nameTargetChild.name}'s profile.`
        : `Creates a new profile for ${nameInput.trim()}.`;

  // Boy or girl is already on that child's profile: asking again is a wasted tap, and the
  // answer arrives with the child's pre-fill when the name is confirmed.
  const genderOnFile = !!nameTargetChild?.gender;

  const retake = () => {
    setRetaking(true);
    // Results from a logged-out session are being thrown away, not saved later by accident.
    pendingImport.current = null;
    setAnswers({ ...EMPTY_ANSWERS });
    setNameInput("");
    setSavedStatus("idle");
    setChosenSport(null);
    goToStep(1);
  };

  /**
   * The parent committing to a sport. Optimistic — the pick drives the trial
   * CTA, the screening pre-fill and the check-in immediately, and a failed
   * write shouldn't undo a decision they can see they made.
   */
  const chooseSport = (sport: string) => {
    if (sport === chosenSport) return;
    setChosenSport(sport);

    // Guests have no dependent to write to; the pick rides along with the
    // results in localStorage and transfers on registration.
    if (!token) {
      try {
        const raw = localStorage.getItem("pms_wizard_results");
        const saved = raw ? JSON.parse(raw) : { answers, savedAt: new Date().toISOString() };
        localStorage.setItem(
          "pms_wizard_results",
          JSON.stringify({ ...saved, chosenSport: sport })
        );
      } catch {}
      return;
    }

    setChoosingSport(true);
    api
      .post("/plan-checkins/find-sport-trial/choice", {
        dependentId: selectedDependentId || undefined,
        sport,
        signals: trialSignals(firstNoteFor(sport, results, chosenFits), answers.childName),
      })
      .then(() => {
        // The auth store's `user.dependents` otherwise keeps the pre-choice
        // snapshot — anything reading it (e.g. the homepage hero) would show
        // stale state until the next login/reload.
        if (selectedDependentId) void refreshProfile();
      })
      .catch(() => {})
      .finally(() => setChoosingSport(false));
  };

  // Run scoring on the processing screen, then auto-advance to results.
  useEffect(() => {
    if (currentStep.kind === "processing") {
      const timer = setTimeout(async () => {
        const scored = scoreSports(answers);
        const chosen = scoreChosenSports(answers);

        // Save to profile if logged in with a selected dependent (update)
        if (token && selectedDependentId) {
          setSavedStatus("saving");
          const displayName =
            players.find((p) => p._id === selectedDependentId)?.name.split(" ")[0] ??
            answers.childName;
          try {
            await updateChild(
              selectedDependentId,
              buildDependentPayload(answers, scored, undefined, chosen)
            );
            setSavedForName(displayName || undefined);
            setSavedStatus("saved");
            scheduleTrialCheckIn(
              selectedDependentId,
              scored,
              chosen,
              displayName || answers.childName
            );
          } catch {
            setSavedStatus("error");
          }
        } else if (token && !selectedDependentId) {
          // Logged-in parent with no child selected — create a new child profile
          setSavedStatus("saving");
          const childName = answers.childName?.trim() || "My Child";
          try {
            const { child } = await addChild({
              name: childName,
              ...buildDependentPayload(answers, scored, childName, chosen),
            });
            if (child?._id) setSelectedDependentId(child._id);
            setSavedForName(childName);
            setSavedStatus("saved");
            scheduleTrialCheckIn(child?._id ?? null, scored, chosen, childName);
          } catch {
            setSavedStatus("error");
          }
        } else if (!token) {
          // Guest: save to localStorage so the results survive a soft reload
          try {
            localStorage.setItem(
              "pms_wizard_results",
              JSON.stringify({
                answers,
                results: [
                  ...chosen.map((r) => ({
                    sport: r.sport.name,
                    fitLabel: r.fitLabel,
                    score: r.score,
                  })),
                  ...scored.map((r) => ({
                    sport: r.sport.name,
                    fitLabel: r.fitLabel,
                    score: r.score,
                  })),
                ].slice(0, 3),
                savedAt: new Date().toISOString(),
              })
            );
          } catch {}
        }

        goNext();
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Where guests drop off. Page views carry only the path, so all of the wizard's steps
  // counted as one page (audit F10). The step and question key only: never an answer.
  useEffect(() => {
    trackGuest({
      eventName: "wizard_step",
      entityType: "WIZARD",
      entityId: ASSESSMENT_FLOW.id,
      metadata: {
        step: stepIndex + 1,
        kind: currentStep.kind,
        ...(currentStep.kind === "question" ? { question: currentStep.questionKey } : {}),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Each step starts at its heading. Steps change with `scroll: false`, so a parent who
  // pressed a button at the bottom of a long screen (the welcome, the sports list, on a
  // phone almost any step) landed partway down the next one, below its question.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  // Focus name input when on name screen
  useEffect(() => {
    if (currentStep.kind === "name") nameRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const selectedPlayer = players.find((p) => p._id === selectedDependentId);

  return {
    token,
    answers,
    setAnswer,
    nameInput,
    setNameInput,
    confirmName,
    nameTarget,
    genderOnFile,
    nameRef,
    chosenSport,
    choosingSport,
    players,
    selectedDependentId,
    selectDependent,
    startNewChild,
    savedStatus,
    savedForName,
    suggestedChildId,
    saveResultsTo,
    results,
    chosenFits,
    stepIndex,
    direction,
    goNext,
    goBack,
    currentStep,
    progress,
    showProgress,
    showBack,
    isFullScreen,
    currentSection,
    sectionMeta,
    profileChips,
    retake,
    chooseSport,
    selectedPlayer,
  };
}
