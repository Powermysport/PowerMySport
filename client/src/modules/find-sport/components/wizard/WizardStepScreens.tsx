import { motion } from "framer-motion";
import { Button } from "@/modules/shared/ui/Button";
import { fieldClass } from "../inputs/optionStyles";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { PRIOR_SPORTS_OPTIONS } from "../../data/sportProfiles";
import type { WizardAnswers } from "../../types";
import { MAX_CONSIDERED_SPORTS } from "../../types";
import { BinaryCards } from "../inputs/BinaryCards";
import { ChoiceRows } from "../inputs/ChoiceRows";
import { StateSelector } from "../inputs/StateSelector";
import { FourContextCards } from "../inputs/FourContextCards";
import { MultiSelectPills } from "../inputs/MultiSelectPills";
import { SpectrumSlider } from "../inputs/SpectrumSlider";
import { ThreeOptionCards } from "../inputs/ThreeOptionCards";
import { cmToFeetInches } from "../../utils/dependentMapping";
import { defaultHeightCm, defaultWeightKg, displayedDefault } from "../../utils/questionDefaults";
import {
  DOB_BOUNDS,
  isYoungChild,
  PRACTICE_OPTIONS,
  practiceValue,
  YOUNG_CHILD_SKIPPED,
} from "./wizardSteps";

// ─── Question screen renderer ─────────────────────────────────────────────────

export function QuestionScreen({
  questionKey,
  answers,
  onAnswer,
  onNext,
}: {
  questionKey: keyof WizardAnswers | "priorSports";
  answers: WizardAnswers;
  onAnswer: (key: keyof WizardAnswers, value: WizardAnswers[keyof WizardAnswers]) => void;
  onNext: () => void;
}) {
  const name = answers.childName || "your child";
  const cap = name.charAt(0).toUpperCase() + name.slice(1);

  // Pronoun helpers — resolve to he/she when gender is known, singular "they"
  // otherwise (unanswered or "prefer not to say").
  const isPlural = answers.gender !== "boy" && answers.gender !== "girl";
  const pn = answers.gender === "boy" ? "he" : answers.gender === "girl" ? "she" : "they";
  const pnObj = answers.gender === "boy" ? "him" : answers.gender === "girl" ? "her" : "them";
  const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // 3rd-person singular conjugation for "he"/"she"; base form for "they". Pass
  // an explicit singular form for irregulars (catch -> catches, miss -> misses).
  const v = (base: string, singular?: string) => (isPlural ? base : (singular ?? `${base}s`));

  // Auto-advance helper for binary questions
  const autoAdvance = (key: keyof WizardAnswers, val: WizardAnswers[keyof WizardAnswers]) => {
    onAnswer(key, val);
    setTimeout(onNext, 200);
  };

  const section: Record<string, string> = {
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

  const renderInput = () => {
    switch (questionKey) {
      case "dob":
        return (
          <div className="space-y-3">
            <input
              type="date"
              value={answers.dob ?? ""}
              min={DOB_BOUNDS.min}
              max={DOB_BOUNDS.max}
              onChange={(e) => {
                const val = e.target.value || null;
                const age = getDependentAge(val);
                onAnswer("dob", val);
                onAnswer("age", age);
                // Under 8 these two are skipped; drop any earlier guess so it can't score.
                if (isYoungChild(age)) YOUNG_CHILD_SKIPPED.forEach((k) => onAnswer(k, null));
              }}
              aria-label="Date of birth"
              className={fieldClass}
            />
            {answers.dob && answers.age !== null && (
              <p className="text-ink-body text-sm">
                That makes {cap} {answers.age} years old.
              </p>
            )}
          </div>
        );

      case "state":
        return <StateSelector value={answers.state} onChange={(s) => onAnswer("state", s)} />;

      case "priorSports":
        // Two related answers on one screen (audit F4): what the child plays now, and what
        // the family is weighing up. Same list, so they read as one decision.
        return (
          <div className="space-y-7">
            <MultiSelectPills
              options={PRIOR_SPORTS_OPTIONS}
              selected={answers.priorSports}
              onChange={(v) => onAnswer("priorSports", v)}
              noneLabel="None right now"
            />
            <div className="border-hairline border-t pt-6">
              <p className="text-ink text-lg font-medium">
                Any sports you are already considering?
              </p>
              <p className="text-ink-body mb-4 mt-1 text-pretty text-sm leading-relaxed">
                Pick up to {MAX_CONSIDERED_SPORTS}, or skip and we will suggest some. We score each
                one against your answers and say where {name} fits and where {pn}{" "}
                {isPlural ? "don't" : "doesn't"}.
              </p>
              <MultiSelectPills
                options={PRIOR_SPORTS_OPTIONS}
                selected={answers.consideringSports}
                onChange={(v) => onAnswer("consideringSports", v)}
                noneLabel="No, help me decide"
                max={MAX_CONSIDERED_SPORTS}
              />
            </div>
          </div>
        );

      case "height": {
        const hVal = answers.height ?? defaultHeightCm(answers.age);
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="1 cm shorter"
                onClick={() => onAnswer("height", Math.max(80, hVal - 1))}
                className="text-ink border-hairline hover:border-ink/40 focus-visible:ring-ink focus-visible:ring-offset-paper flex h-12 w-12 select-none items-center justify-center rounded-md border bg-white text-2xl font-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                −
              </button>
              <div className="min-w-[120px] text-center">
                <span className="font-editorial text-ink text-6xl font-light tabular-nums">
                  {hVal}
                </span>
                <span className="text-ink-body ml-2 text-xl">cm</span>
                <p className="text-ink-body mt-1 text-sm tabular-nums">{cmToFeetInches(hVal)}</p>
              </div>
              <button
                type="button"
                aria-label="1 cm taller"
                onClick={() => onAnswer("height", Math.min(220, hVal + 1))}
                className="text-ink border-hairline hover:border-ink/40 focus-visible:ring-ink focus-visible:ring-offset-paper flex h-12 w-12 select-none items-center justify-center rounded-md border bg-white text-2xl font-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                +
              </button>
            </div>
            <input
              type="range"
              aria-label="Height in cm"
              min={80}
              max={220}
              step={1}
              value={hVal}
              onChange={(e) => onAnswer("height", parseInt(e.target.value))}
              className="accent-ink w-full"
            />
            <div className="text-ink-muted -mt-2 flex justify-between text-sm">
              <span>80 cm · 2′ 7″</span>
              <span>220 cm · 7′ 3″</span>
            </div>
          </div>
        );
      }

      case "weight": {
        const wVal = answers.weight ?? defaultWeightKg(answers.age);
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="1 kg lighter"
                onClick={() => onAnswer("weight", Math.max(15, wVal - 1))}
                className="text-ink border-hairline hover:border-ink/40 focus-visible:ring-ink focus-visible:ring-offset-paper flex h-12 w-12 select-none items-center justify-center rounded-md border bg-white text-2xl font-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                −
              </button>
              <div className="min-w-[120px] text-center">
                <span className="font-editorial text-ink text-6xl font-light tabular-nums">
                  {wVal}
                </span>
                <span className="text-ink-body ml-2 text-xl">kg</span>
              </div>
              <button
                type="button"
                aria-label="1 kg heavier"
                onClick={() => onAnswer("weight", Math.min(120, wVal + 1))}
                className="text-ink border-hairline hover:border-ink/40 focus-visible:ring-ink focus-visible:ring-offset-paper flex h-12 w-12 select-none items-center justify-center rounded-md border bg-white text-2xl font-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                +
              </button>
            </div>
            <input
              type="range"
              aria-label="Weight in kg"
              min={15}
              max={120}
              step={1}
              value={wVal}
              onChange={(e) => onAnswer("weight", parseInt(e.target.value))}
              className="accent-ink w-full"
            />
            <div className="text-ink-muted -mt-2 flex justify-between text-sm">
              <span>15 kg</span>
              <span>120 kg</span>
            </div>
          </div>
        );
      }

      case "energyType":
        return (
          <BinaryCards
            options={[
              {
                value: "explosive",
                title: "Sprints hard, then needs a breather",
                sub: `${cap} goes flat out for a bit, gives everything, then sits out to recover`,
              },
              {
                value: "endurance",
                title: "Keeps going the whole time",
                sub: "Doesn't tire quickly, still going strong after everyone else has stopped",
              },
            ]}
            value={answers.energyType}
            onChange={(v) => autoAdvance("energyType", v as WizardAnswers["energyType"])}
          />
        );

      case "visualTracking":
        return (
          <ThreeOptionCards
            options={[
              { value: "strong", label: `${cap1(v("track"))} and ${v("react")} naturally` },
              {
                value: "moderate",
                label: `Sometimes ${v("catch", "catches")} it, sometimes ${v("miss", "misses")}, depends on the day`,
              },
              {
                value: "weak",
                label: `Usually ${v("miss", "misses")} or ${v("react")} late to fast-moving objects`,
              },
            ]}
            value={answers.visualTracking}
            onChange={(v) => {
              onAnswer("visualTracking", v as WizardAnswers["visualTracking"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "teamIndividual":
        return (
          <SpectrumSlider
            value={answers.teamIndividual}
            onChange={(v) => onAnswer("teamIndividual", v)}
            leftLabel="Just me"
            rightLabel="Team, always"
            leftExamples="Tennis, Badminton, Chess"
            rightExamples="Football, Cricket, Hockey"
          />
        );

      case "focusStyle":
        // Focus and repetition in one question (PRACTICE_OPTIONS). Under 8 only the focus
        // half is asked: repetition is a guess at that age.
        if (isYoungChild(answers.age)) {
          return (
            <BinaryCards
              options={[
                {
                  value: "bursts",
                  title: "Focuses hard, then needs a break",
                  sub: `${cap} is fully locked in for 20 to 30 minutes, then needs to get up and move`,
                },
                {
                  value: "sustained",
                  title: "Can stay with it for hours",
                  sub: `Once ${name} is absorbed in something ${pn} ${v("like")}, ${pn} ${v("lose")} track of time`,
                },
              ]}
              value={answers.focusStyle}
              onChange={(v) => autoAdvance("focusStyle", v as WizardAnswers["focusStyle"])}
            />
          );
        }
        return (
          <FourContextCards
            options={PRACTICE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              context: o.context,
            }))}
            value={practiceValue(answers)}
            onChange={(v) => {
              const opt = PRACTICE_OPTIONS.find((o) => o.value === v);
              if (!opt) return;
              onAnswer("focusStyle", opt.focus);
              onAnswer("repetitionTolerance", opt.repetition);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "decisionStyle":
        return (
          <BinaryCards
            options={[
              {
                value: "react",
                title: "Jumps in and figures it out by doing",
                sub: `${cap} acts on instinct first, thinking about it comes after`,
              },
              {
                value: "strategic",
                title: "Watches and plans before joining in",
                sub: `${cap} wants to understand the rules and think it through first`,
              },
            ]}
            value={answers.decisionStyle}
            onChange={(v) => autoAdvance("decisionStyle", v as WizardAnswers["decisionStyle"])}
          />
        );

      case "pressureResponse":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "thrives",
                label: `${cap} performs even better when all eyes are on ${pnObj}, thrives under the spotlight`,
              },
              {
                value: "manages",
                label:
                  "Gets nervous but manages through it, performs reasonably well under pressure",
              },
              {
                value: "avoids",
                label: `${cap} strongly prefers not to be the centre of attention`,
              },
            ]}
            value={answers.pressureResponse}
            onChange={(v) => {
              onAnswer("pressureResponse", v as WizardAnswers["pressureResponse"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "eyesight":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "sharp",
                label: `${cap} has clear, sharp vision, no glasses or contacts needed`,
              },
              { value: "corrected", label: `${cap} wears glasses or contact lenses` },
              { value: "limited", label: `${cap} has difficulty seeing clearly even with glasses` },
            ]}
            value={answers.eyesight}
            onChange={(v) => {
              onAnswer("eyesight", v as WizardAnswers["eyesight"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "agility":
        return (
          <ThreeOptionCards
            options={[
              {
                value: "high",
                label: `Very agile, ${name} moves quickly, changes direction easily, and is naturally flexible`,
              },
              {
                value: "moderate",
                label: "Average agility, moves well enough but not exceptional",
              },
              {
                value: "low",
                label: `${cap} is less agile, prefers steadier, less dynamic physical movement`,
              },
            ]}
            value={answers.agility}
            onChange={(v) => {
              onAnswer("agility", v as WizardAnswers["agility"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "contactComfort":
        // Three small comfort questions as rows on one screen (audit F4). All three are
        // still saved as before: contact and water are hard gates in the scorer.
        return (
          <ChoiceRows
            rows={[
              {
                id: "contact",
                label: "Physical contact (bumping, tackling, wrestling)",
                value: answers.contactComfort,
                onChange: (v) => onAnswer("contactComfort", v as WizardAnswers["contactComfort"]),
                options: [
                  { value: "loves", label: "Loves it" },
                  { value: "neutral", label: "Doesn't mind" },
                  { value: "avoids", label: "Avoids it" },
                ],
              },
              {
                id: "water",
                label: "Being in water",
                value: answers.waterComfort,
                onChange: (v) => onAnswer("waterComfort", v as WizardAnswers["waterComfort"]),
                options: [
                  { value: "comfortable", label: "Loves it" },
                  { value: "neutral", label: "It's okay" },
                  { value: "uncomfortable", label: "Uneasy or afraid" },
                ],
              },
              {
                id: "environment",
                label: "On a free afternoon, would rather be",
                value: answers.environment,
                onChange: (v) => onAnswer("environment", v as WizardAnswers["environment"]),
                options: [
                  { value: "outdoor", label: "Outdoors" },
                  { value: "indoor", label: "Indoors" },
                  { value: "no-preference", label: "Either" },
                ],
              },
            ]}
          />
        );

      case "budget":
        return (
          <FourContextCards
            options={[
              {
                value: "under-3k",
                label: "Under ₹3,000/month",
                context: "Covers: cricket, football, chess, hockey",
              },
              {
                value: "3k-7k",
                label: "₹3,000 – ₹7,000/month",
                context: "Covers: badminton, swimming, plus everything above",
              },
              {
                value: "7k-15k",
                label: "₹7,000 – ₹15,000/month",
                context: "Covers: tennis, every sport in our list",
              },
              {
                value: "15k-plus",
                label: "₹15,000+/month",
                context: "Every sport covered, room for premium academies and coaching",
              },
            ]}
            value={answers.budget}
            onChange={(v) => {
              onAnswer("budget", v as WizardAnswers["budget"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "ambition":
        return (
          <FourContextCards
            options={[
              {
                value: "fun",
                label: "Health, confidence, and fun",
                context: "No pressure on results, sport as a positive life habit",
              },
              {
                value: "competitive",
                label: "District and state-level competition",
                context: "Serious about sport, but not chasing it as a livelihood",
              },
              {
                value: "national",
                label: "National representation",
                context: "We are committed to the long journey this requires",
              },
              {
                value: "career",
                label: "Building a career in sport",
                context: "A sports-quota job, a college place, or turning pro",
              },
            ]}
            value={answers.ambition}
            onChange={(v) => {
              onAnswer("ambition", v as WizardAnswers["ambition"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      case "weeklyHours":
        return (
          <FourContextCards
            options={[
              {
                value: "1-3",
                label: "1–3 hours/week",
                context: "A couple of casual sessions, sport fits around everything else",
              },
              {
                value: "4-7",
                label: "4–7 hours/week",
                context: "Regular training, about 1 hour on most days",
              },
              {
                value: "8-12",
                label: "8–12 hours/week",
                context: "Serious commitment, two sessions on many days",
              },
              {
                value: "13-plus",
                label: "13+ hours/week",
                context: "Full dedication, sport is the main priority",
              },
            ]}
            value={answers.weeklyHours}
            onChange={(v) => {
              onAnswer("weeklyHours", v as WizardAnswers["weeklyHours"]);
              setTimeout(onNext, 200);
            }}
          />
        );

      default:
        return null;
    }
  };

  const questions: Partial<Record<string, string>> = {
    dob: `What is ${name}'s date of birth?`,
    state: "Which state are you based in?",
    // Saved as the child's `sportsFocus`, which the rest of the app (dashboard, planner,
    // AI chat, WhatsApp, mobile) reads as the sport they play. "Tried before" let a single
    // school session become their sport everywhere (audit F14), so ask what is true now.
    priorSports: `Which sports does ${name} play regularly now?`,
    height: `How tall is ${name}?`,
    weight: `How much does ${name} weigh?`,
    energyType: `In a game of tag or running around with friends, what does ${name} usually do?`,
    visualTracking: `When something moves fast toward ${name} (a ball, a shuttle), ${pn}:`,
    teamIndividual: `At a birthday party with a group game, does ${name} want a partner or team, or go it alone?`,
    focusStyle: isYoungChild(answers.age)
      ? `Think of ${name} doing a puzzle or building something, ${pn} ${v("tend")} to:`
      : `Think of ${name} practising something (homework, a puzzle, a skill). Which sounds most like ${pnObj}?`,
    decisionStyle: `When ${name} plays a new game for the first time, ${pn} usually:`,
    pressureResponse: `When all attention is on ${name} (a school event, a family gathering):`,
    eyesight: `How is ${name}'s eyesight?`,
    agility: `How agile and flexible is ${name}?`,
    contactComfort: `What is ${name} comfortable with?`,
    budget: "What can your family realistically invest in training each month?",
    ambition: "What is your honest goal for this sport journey?",
    weeklyHours: `How many hours per week can ${name} dedicate to sport training?`,
  };

  const questionSubs: Partial<Record<string, string>> = {
    priorSports:
      "Only sports with regular practice or coaching. Something tried once or twice does not count.",
  };

  const needsNextButton =
    questionKey === "dob" ||
    questionKey === "state" ||
    questionKey === "height" ||
    questionKey === "weight" ||
    questionKey === "priorSports" ||
    questionKey === "contactComfort" ||
    questionKey === "teamIndividual";

  const canAdvance = () => {
    if (questionKey === "dob") return !!answers.dob && answers.age !== null;
    if (questionKey === "priorSports") return true;
    if (questionKey === "contactComfort")
      return !!answers.contactComfort && !!answers.waterComfort && !!answers.environment;
    if (questionKey === "state") return !!answers.state;
    if (questionKey === "height") return true; // default pre-filled from age
    if (questionKey === "weight") return true; // default pre-filled from age
    if (questionKey === "teamIndividual") return answers.teamIndividual !== null;
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted mb-3 text-sm font-medium">{section[questionKey] ?? ""}</p>
        <h2 className="font-editorial text-ink text-balance text-3xl font-light leading-tight sm:text-[2.125rem]">
          {questions[questionKey] ?? ""}
        </h2>
        {questionSubs[questionKey] && (
          <p className="text-ink-body mt-3 text-pretty text-base leading-relaxed">
            {questionSubs[questionKey]}
          </p>
        )}
      </div>

      {renderInput()}

      {needsNextButton && (
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            const shown = displayedDefault(questionKey, answers);
            if (shown) onAnswer(shown.key, shown.value);
            onNext();
          }}
          disabled={!canAdvance()}
        >
          Continue
        </Button>
      )}
    </div>
  );
}

// ─── Processing screen ────────────────────────────────────────────────────────

export function ProcessingScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center space-y-4 py-20 text-center"
    >
      <div
        aria-hidden="true"
        className="border-ink h-10 w-10 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
      />
      <p role="status" className="font-editorial text-ink text-3xl font-light">
        Building {name || "your child"}&apos;s sport profile...
      </p>
      <p className="text-ink-body max-w-sm text-base">
        Matching what you&apos;ve shared with sport requirements, training pathways, and what&apos;s
        available in your city.
      </p>
    </motion.div>
  );
}
