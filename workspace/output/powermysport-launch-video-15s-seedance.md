# PowerMySport launch video: 15s four-shot prompt (Seedance 2.0)

Status: NOT generated. Tried on 2026-11-11 from Claude Code with unlimited
generations; Higgsfield refused because unlimited generations only work from
Claude chat, Claude Cowork or ChatGPT.

**Model**: Seedance 2.0 (`seedance_2_0`)
**Aspect ratio**: 16:9 **Duration**: 15s **Resolution**: 720p **Mode**: std
**Audio**: on **Unlimited generations**: yes (`use_unlim: true`)

```
SCENE CONTEXT: A quiet early morning at a public clay tennis court in an Indian city, the hour before a local tournament. Four shots in real time, observational documentary register.

LOCATION MAP: One red clay court with white lines, a green wire fence, a wooden bench on the left sideline, low trees beyond the fence. Light haze, density 20%, visible past 30 meters. The set contains only what is described here.

FORMAT MODE: Timed multishot, 15 seconds, four shots. Cuts only at the specified points, the camera does not cut on its own.

SHOT 1 (0.0-3.5s), wide, 84 degrees, static locked tripod: the empty court at first light, long fence shadows across the clay, a few leaves drifting left to right over the baseline.
3.5s HARD CUT.
SHOT 2 (3.5-7.0s), close-up, 18 degrees, gentle handheld: a player's hands in white wristbands pull the laces of a white tennis shoe tight on the bench, tie a double knot, then the shoe presses flat onto the clay and a little clay dust lifts.
7.0s HARD CUT.
SHOT 3 (7.0-11.0s), medium, 47 degrees, stabilized tracking moving left to right: the player, seen from behind in a plain white kit and cap, 150 cm tall, walks from the bench to the baseline with a racket in the right hand and bounces a ball twice. An adult in a cream linen shirt, 172 cm tall, stands at the fence on the right of frame, hands resting on the wire, watching.
11.0s HARD CUT.
SHOT 4 (11.0-15.0s), extreme wide, 107 degrees, slow crane rising: the player tosses the ball and swings one full serve, the ball travels across the net. The crane keeps rising and ends held still on the whole court small in the lower third, open pale morning sky filling the upper two thirds.

LIGHTING: low sun from camera left, 4000K fixed, long soft shadows.
COLOR GRADE: warm paper tones, saturation about 70%, cream highlights, warm near-black shadows, orange only in the clay.
AUDIO: morning birds, a lace pulled tight, shoes on clay, two ball bounces, one clean racket strike. No music. No speech.
STYLE: photorealistic documentary, natural skin texture, 24 fps.

POSITIVE LOCKS: Same court, fence, bench and light in every shot. Plain unbranded clothing and equipment. Anatomically correct, all limbs naturally positioned. Smooth, fluid motion. The player stays human-sized in the wide shots.
```

## Notes

- The last 1.5 seconds end on open sky so the wordmark and tagline can be
  added in an editor from `client/public/header_logo_1.png`.
- Not run through the Seedance linter (`scripts/seedance_lint.py`) yet.
