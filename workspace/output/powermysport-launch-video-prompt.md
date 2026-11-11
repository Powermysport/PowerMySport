# PowerMySport launch video: landscape prompt

Status: prompt ready, NOT generated yet. Checked live on 2026-11-11: schema matches, cost is 20 credits (8s, pro, sound on), account balance is 0 credits on the free plan.

**Model**: Kling 3.0 (`kling3_0`)
**Aspect ratio**: 16:9 **Duration**: 8s **Style**: Cinematic (golden-hour backlight)
**Mode**: pro **Sound**: on

```
A junior tennis player in a plain white kit stands at the baseline of a public
hard court in an Indian city at sunrise, bouncing a ball twice, then tosses it
high and drives a full serve across the net. Behind the fence a parent in a
simple cotton kurta watches with hands resting on the wire, then lifts one hand
in a small, proud clap as the ball lands. Chalk dust lifts off the line, long
shadows stretch across the court, a few kit bags sit on a bench.

Camera: Dolly In, slow and steady, from a wide view of the whole court to a
medium shot of the player, parent held in soft focus behind.

Style: golden-hour backlight from low sun, warm cream and burnt-orange palette,
deep ink shadows, natural skin texture, subject in sharp focus, background
falling into soft bokeh. Anatomically correct, all limbs visible and naturally
positioned. Smooth, fluid motion, one action per shot. Plain unbranded
clothing and equipment.

Audio: morning birds, distant city hum, two ball bounces, one clean racket
strike, a single soft clap. No music.
```

**Camera**: Dolly In
**Motion preset**: none

## Preflight (run before spending credits)

1. Schema check: `models_explore(action="get", model_id="kling3_0")`. The local
   spec snapshot is dated 2026-09-26 (over 30 days old), so the enums above
   (16:9, 3-15s, std/pro/4k, sound on/off) must be confirmed live.
2. Cost check: `generate_video` with `get_cost: true` and the params above, plus `balance`.

## Notes

- The wordmark, tagline and end card are best added in an editor afterwards.
  Video models render text unreliably and brand names can trip filters.
- Defaults assumed: 8s, single shot, tennis, no voiceover.
