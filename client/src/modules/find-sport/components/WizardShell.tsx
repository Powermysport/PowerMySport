"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import { ResultsView } from "./results/ResultsView";
import { QuestionScreen, ProcessingScreen } from "./wizard/WizardStepScreens";
import { SECTION_META, SECTION_ORDER, QUESTIONS_ASKED } from "./wizard/wizardSteps";
import { ChoiceRows } from "./inputs/ChoiceRows";
import { chipClass, fieldClass } from "./inputs/optionStyles";
import { useWizardShell } from "../hooks/useWizardShell";

// ─── Main wizard shell ────────────────────────────────────────────────────────

export function WizardShell() {
  const {
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
  } = useWizardShell();

  const firstName = selectedPlayer?.name.split(" ")[0];

  return (
    <div className="bg-paper flex min-h-screen">
      {/* ── Section sidebar (desktop, question steps only) ──
          A deeper-cream band, per client/DESIGN.md: sections are told apart by tone, and
          nothing outside the homepage goes dark. */}
      {!isFullScreen && (
        <div className="bg-paper-deep border-hairline hidden w-[300px] shrink-0 border-r lg:block xl:w-[340px]">
          <aside className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-10">
              <p className="text-ink-muted text-sm font-medium">Sport assessment</p>

              {sectionMeta && (
                <div key={currentSection} className="mt-6">
                  <h2 className="font-editorial text-ink text-balance text-3xl font-light leading-tight">
                    {sectionMeta.title}
                  </h2>
                  <p className="text-ink-body mt-3 text-pretty text-sm leading-relaxed">
                    {sectionMeta.desc}
                  </p>
                </div>
              )}

              <ol className="border-hairline mt-8 space-y-2.5 border-t pt-6">
                {SECTION_ORDER.map((key) => {
                  const here = key === currentSection;
                  const done = SECTION_ORDER.indexOf(key) < SECTION_ORDER.indexOf(currentSection);
                  return (
                    <li
                      key={key}
                      aria-current={here ? "step" : undefined}
                      className={`flex items-center gap-2.5 text-sm ${
                        here ? "text-ink font-medium" : done ? "text-ink-body" : "text-ink-muted"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`mx-1 h-1.5 w-1.5 rounded-full ${here ? "bg-ink" : "bg-ink/25"}`}
                        />
                      )}
                      {SECTION_META[key].title}
                    </li>
                  );
                })}
              </ol>

              {/* What the parent has told us so far, as it fills in */}
              {profileChips.length > 0 && (
                <div className="mt-8">
                  <p className="text-ink-muted mb-3 text-sm font-medium">So far</p>
                  <dl className="flex flex-wrap gap-1.5">
                    {profileChips.map((chip) => (
                      <div
                        key={chip.label}
                        className="border-hairline bg-paper flex items-baseline gap-1.5 rounded-md border px-2.5 py-1"
                      >
                        <dt className="text-ink-muted text-xs">{chip.label}</dt>
                        <dd className="text-ink text-xs font-medium">{chip.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <div className="border-hairline border-t px-8 py-6">
              <div className="text-ink-body mb-2 flex justify-between text-sm">
                <span>Progress</span>
                <span className="text-ink font-medium tabular-nums">{progress}%</span>
              </div>
              <ProgressLine value={progress} />
            </div>
          </aside>
        </div>
      )}

      {/* ── Main column ── */}
      <div className="flex min-h-screen flex-1 flex-col">
        {showProgress && (
          <div className={isFullScreen ? "" : "lg:hidden"}>
            <ProgressLine value={progress} flush />
          </div>
        )}

        {showBack && (
          <div className="flex shrink-0 items-center px-5 pt-5 lg:px-10">
            <button
              type="button"
              onClick={goBack}
              className="text-ink-body hover:text-ink focus-visible:ring-ink focus-visible:ring-offset-paper -ml-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Back
            </button>
          </div>
        )}

        {/* The results step is a report: it needs the extra width for side-by-side
            fit and gap columns. Questions keep a reading measure. */}
        <div
          className={`mx-auto w-full flex-1 px-5 py-8 lg:py-12 ${
            currentStep.kind === "results"
              ? "max-w-6xl lg:px-10 xl:px-12"
              : isFullScreen
                ? "max-w-3xl lg:px-10"
                : "max-w-2xl lg:mx-0 lg:px-10 xl:px-16"
          }`}
        >
          <div
            key={stepIndex}
            className={`animate-in fade-in duration-200 motion-reduce:animate-none ${direction >= 0 ? "slide-in-from-right-8" : "slide-in-from-left-8"}`}
          >
            {/* Welcome: logged-in parents only (guests start on the name screen). It is where
                they say which child this is for. */}
            {currentStep.kind === "welcome" && (
              <div className="py-6 sm:py-10">
                <p className="text-ink-muted text-sm font-medium">Sport assessment</p>
                <h1 className="text-ink mt-4 text-balance text-[33px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl">
                  Find the sports that{" "}
                  <span className="font-editorial text-[1.22em] font-light italic tracking-[-0.02em]">
                    suit your child.
                  </span>
                </h1>
                <p className="text-ink-body mt-6 max-w-[56ch] text-pretty text-lg leading-relaxed">
                  {QUESTIONS_ASKED} short questions about how your child moves and plays, and what
                  your family can commit to. Answer as you see them today. There are no right or
                  wrong answers.
                </p>

                <ul className="border-hairline text-ink-body mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm">
                  {["Free", "About 5 minutes", "See which sports fit, and why"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="text-ink h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>

                {players.length > 0 && (
                  <fieldset className="mt-10">
                    <legend className="text-ink text-base font-medium">Who is this for?</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {players.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          aria-pressed={selectedDependentId === p._id}
                          onClick={() => selectDependent(p)}
                          className={chipClass(selectedDependentId === p._id)}
                        >
                          {p.name.split(" ")[0]}
                          {selectedDependentId === p._id && p.wizardCompletedAt && (
                            <span className="ml-1.5 text-xs opacity-75">retake</span>
                          )}
                        </button>
                      ))}
                      {selectedDependentId && (
                        <button type="button" onClick={startNewChild} className={chipClass(false)}>
                          Someone new
                        </button>
                      )}
                    </div>
                    {selectedDependentId && selectedPlayer?.wizardCompletedAt && (
                      <p className="text-ink-body mt-3 text-sm">
                        Answers are filled in from {firstName}&apos;s last assessment. Change
                        anything that is different now.
                      </p>
                    )}
                  </fieldset>
                )}

                <div className="mt-10">
                  <Button size="lg" onClick={goNext} className="w-full sm:w-auto">
                    {selectedDependentId ? `Start for ${firstName}` : "Start the assessment"}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep.kind === "name" && (
              <div className="space-y-6 py-4">
                <div>
                  <h2 className="font-editorial text-ink text-balance text-3xl font-light leading-tight sm:text-4xl">
                    Let&apos;s start. What&apos;s your child&apos;s name?
                  </h2>
                  <p className="text-ink-body mt-3 text-base">
                    {token
                      ? "Just so the questions can use their name."
                      : "About 5 minutes. Free, and no account needed to see the results."}
                  </p>
                </div>
                <div>
                  <label htmlFor="wizard-child-name" className="sr-only">
                    Child&apos;s first name
                  </label>
                  <input
                    id="wizard-child-name"
                    ref={nameRef}
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Aryan"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nameInput.trim() && (answers.gender || genderOnFile))
                        confirmName(nameInput);
                    }}
                    className={fieldClass}
                  />
                  {nameTarget && (
                    <p className="text-ink-body mt-2 text-sm" aria-live="polite">
                      {nameTarget}
                    </p>
                  )}
                </div>
                {/* Boy or girl rides on the name screen (audit F4): one tap, and every
                    question after it can say "he" or "she". Not asked again for a child
                    whose profile already has it. */}
                {!genderOnFile && (
                  <ChoiceRows
                    rows={[
                      {
                        id: "gender",
                        label: "Boy or girl?",
                        value: answers.gender,
                        onChange: (v) => setAnswer("gender", v as typeof answers.gender),
                        options: [
                          { value: "boy", label: "Boy" },
                          { value: "girl", label: "Girl" },
                          { value: "prefer-not", label: "Prefer not to say" },
                        ],
                      },
                    ]}
                  />
                )}
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => confirmName(nameInput)}
                  disabled={!nameInput.trim() || !(answers.gender || genderOnFile)}
                >
                  {!nameInput.trim()
                    ? "Enter a name to continue"
                    : !(answers.gender || genderOnFile)
                      ? "Choose boy, girl or prefer not to say"
                      : `Continue with ${nameInput.trim()}`}
                </Button>
              </div>
            )}

            {currentStep.kind === "question" && (
              <QuestionScreen
                questionKey={currentStep.questionKey}
                answers={answers}
                onAnswer={setAnswer}
                onNext={goNext}
              />
            )}

            {currentStep.kind === "processing" && <ProcessingScreen name={answers.childName} />}

            {currentStep.kind === "results" && (
              <ResultsView
                results={results}
                chosenFits={chosenFits}
                answers={answers}
                onRetake={retake}
                savedStatus={savedStatus}
                isLoggedIn={!!token}
                savedForName={savedForName}
                dependentId={selectedDependentId ?? undefined}
                chosenSport={chosenSport}
                choosingSport={choosingSport}
                onChooseSport={chooseSport}
                childrenOptions={players}
                suggestedChildId={suggestedChildId}
                onSaveTo={saveResultsTo}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A thin ink progress line on a hairline track. Ink, not orange: orange is the action. */
function ProgressLine({ value, flush = false }: { value: number; flush?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`bg-hairline h-1 w-full overflow-hidden ${flush ? "" : "rounded-full"}`}
    >
      <div
        className="bg-ink h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
