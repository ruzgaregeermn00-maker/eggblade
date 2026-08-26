# EGGBLADE

A neon synthwave arcade slicing game. Swipe to cut flying eggs, dodge bombs, chain combos,
and protect the Eggblade avatar hovering at the bottom of the grid.

**Everything lives in `index.html`** — one self-contained page, no build step, no dependencies,
no image or audio assets. Open the file in a browser (or serve the folder) and play.

```
python3 -m http.server 8000     # then visit http://localhost:8000
```

## What's in it

**Rendering** — HTML5 Canvas, vanilla JS. Deep-space parallax starfield, drifting nebulae,
a banded synth sun, and a scrolling perspective grid that pulses with the beat. Targets are
vector eggs with gradient bodies, rim light, circuit facets and motion streaks; cut eggs split
into two independently simulated halves with a molten cut edge. All glyphs are drawn as vectors,
so nothing depends on a web font loading.

**Feel** — a tapered three-pass plasma blade trail that shifts hue with your active power-up,
spark and shard bursts, expanding shockwave rings, floating `+score` popups, combo banners,
screen shake on detonations, and a chromatic-aberration composite during slow-mo.

**Gameplay** — eggs, golden eggs, bombs and three power-ups launch from below on real ballistic
arcs, aimed so their apex lands in a comfortable slice band:

| Power-up | Effect |
| --- | --- |
| Slow-Mo (blue) | Drops the world to 0.4× with a chromatic-aberration filter |
| Blade Storm (purple) | Auto-slices the nearest target ~11×/sec, bombs excluded |
| Golden Slice (gold) | Triples every slice for its duration |

Chained slices raise a combo tier (2× → 3× → 4× → 5× → 8×) with escalating announcements;
cutting several targets in one motion pays a ribbon bonus. Bombs and missed eggs each cost a heart.

**Difficulty** — Easy / Normal / Hard / Extreme, each with its own launch speed, gravity, bomb
rate, wave size, health pool and score multiplier, and each tracking a separate high score.
Spawn pressure also ramps with time survived.

**Audio** — fully procedural Web Audio: filtered-noise blade swooshes, a glass impact whose pitch
climbs with your combo, a heavy bass detonation, chord chimes for power-ups and records, plus a
generated synthwave loop (bass, arp, pad) over a four-bar minor progression. Compressed master bus,
separate SFX and music gains, toggleable.

**Localization** — complete TR/EN engine, switchable at any time from the top bar; the choice
persists.

**Mobile** — fullscreen, safe-area aware, scroll and gesture locked, DPR-aware canvas up to 2.75×,
glassmorphic HUD. An adaptive quality guard watches frame time and sheds the expensive composite
passes on weak devices instead of dropping frames.

Settings, difficulty choice, language and per-mode high scores persist in `localStorage`
(and degrade gracefully to defaults when storage is unavailable, e.g. private browsing).

## Controls

Swipe or drag to slice. `Esc` / `P` pauses, `Space` starts from the menu.
