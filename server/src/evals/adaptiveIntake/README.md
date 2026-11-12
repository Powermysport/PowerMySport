# Adaptive intake evaluation

Answers two questions about the WhatsApp conversation that understands a parent's own words, asks
only what is missing, confirms it, and then answers or hands it to the team:

1. **Does the conversation behave?** Five invented parents are played through the real code. It
   must never ask for what the first message already said, ask more than three questions, capture a
   wrong age, sport or city, let the assistant answer a personal case or a coach request, or send a
   message WhatsApp would refuse.
2. **Where should the "answer it now" line sit?** Eleven questions are put to the knowledge-base
   search alone, so a person can see what it finds and whether the match really answers the question.

Nothing here is a real parent. The first is the team's own example conversation.

## Run it

Build first (`npm run build` in `server/`), then:

```bash
# Offline. The fixtures stand in for the model and the search: seconds, free, no network.
# Exit code 1 if any rule is broken. Also run by `npm test`.
node dist/evals/adaptiveIntake/run.js

# Live. Gemini reads the messages and searches the knowledge base: about 90 small calls,
# spaced out, roughly 90 seconds. Needs GEMINI_API_KEY in server/.env.
node dist/evals/adaptiveIntake/run.js --model --label my-change-model

# One parent, without rebuilding the knowledge base (about three calls). Every search finds
# nothing, so everything routes to the team: use it to check what the model reads, not the routing.
node dist/evals/adaptiveIntake/run.js --model --only aita-start --skip-knowledge --label aita-check
```

Reports go to `docs/adaptive-intake-eval/<label>.md` and `.json` (that folder is git-ignored).
Options: `--only <parent-id>`, `--skip-knowledge`, `--delay-ms <n>`, `--out <dir>`, `--no-report`.

## It cannot reach the real database

The conversation runs in a throwaway in-memory MongoDB. The connection settings for the real one
are removed from the process after the application's modules load (they reload `server/.env` on
import, so removing them earlier does nothing), Redis is switched off, and the run refuses to start
unless the database it connected to is on this machine. In `--model` mode the knowledge base is
rebuilt in that throwaway database from `knowledgeBaseSources.ts`. Gemini is the only thing
outside this machine that is called.

The test (`src/tests/adaptiveIntakeEval.test.ts`) checks the connection settings are gone, and
checks without printing them.

## What the numbers mean

**Violations must be zero.** Each is a rule broken, counted by the checks in `run.ts`.

**"Opening messages the reader could not read"** counts parents whose first message the model
could not read (busy, over quota, or slower than eight seconds). The usual assistant answers those,
as it did before this feature. It is not a violation, but a high number means the questions will
rarely start.

**The line.** The table of probes shows each question's best knowledge-base matches. Read the titles:
a high score on a match that does not answer the question is the thing to watch. The sweep counts
how many probes each candidate line would answer and how many it routes as wanted. `want` is a
judgement, so check it against the matches before trusting the "right" column.

The first live run (Nov 2026) found every entry that did not answer its question scored 0.66 or
less, and every entry that did scored 0.69 or more, so the default is 0.68
(`WHATSAPP_ANSWER_MIN_SCORE`). The knowledge base is platform FAQs, so only "choosing a sport" and
"what is PowerMySport" are covered: tournaments, scholarships, admissions and fitness go to the team
until content for them is added.

## Adding a parent

Add one to `PERSONAS` in `fixtures.ts`: the opener, what is true about the family, what they say when
asked each question, the category the reader should place it in, which details the opener already
states, and the offline readings. Add a question to `PROBES` to see how the search scores it.
