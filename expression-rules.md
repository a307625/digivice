# Official DMC / PenC expression rules

Study of official Bandai Digital Monster Color and Pendulum Color firmware cells (tero0x Bandai dumps, native 48×48 = 16-grid ×3), plus the DM20 artbook color poses already ingested into this project. Fan/mod sheets were not used.

This document is the rulebook for designed (自製) frames only. Official color cells are never retouched. Designed poses reuse the official body of the same stage × body type, and change only the face: eyes, mouth, and (on humanoids) tongue.

Companion figure: `expression-study.png`.

## Pixel-level findings (Agumon 16-grid, center-sampled from official 48×48)

Official Agumon cells, compared at 16×16:

| Pair | Changed pixels | Where |
|---|---:|---|
| eat1 vs angry | **0** | identical cells |
| eat1 vs attack | **0** | identical cells |
| eat1 vs happy | **6** | head / eye only (the inverted-U eye) |
| idle0 vs happy | 56 | 100% in the head band (open jaw + eye); body from row 7 down is unchanged |
| idle0 vs eat1 | 56 | head only (open jaw); normal oval eye kept |
| idle0 vs refuse | 105 | unique bowed head and hunched body |
| idle0 vs hurt | 99 | unique recoiling slump |
| idle0 vs eat0 | 131 | standing bite; some of this is a 1–2 px bob plus a smaller open mouth |

The six happy-vs-eat1 pixels are the official “happy always has inverted-U (^^) eyes” rule in its smallest form: same open mouth, same standing body, only the eye changes. Angry and attack are the eat1 roar with the normal oval eye, not ^^.

eat0 at native 48×48 is a standing bite with a slightly different jaw than eat1 and a normal eye. idle1 is the only walk cycle; it is not reused as an expression body.

## Universal rules (all stages, all body types)

1. **Happy always has arc / inverted-U (^^) eyes.** If the monster has a visible eye, replace the normal oval/dot with a downward-opening arc (∩ / ^). If the face is a visor or helmet slit with no eye, use a bright gleam in the same inverted-U / chevron shape, not a pasted oval.
2. **Eat and happy both open the mouth, but they are not the same face.** Eat keeps the normal (or fierce) eye. Happy uses the same (or a very slightly wider) open mouth plus ^^ eyes. Do not distinguish them by jumping, arm-raises, or a new body.
3. **Many actions share one standing body** (usually `idle0`). Official cells typically reuse that body for happy, eat0, eat1, and often angry. Only the face changes. `idle1` is the walk. Attack may be that same roar cell (child/adult/perfect dinos) or a real lunge (many megas).
4. **Refuse / overfeed on humanoid-types shows the tongue out**, on the standing body. Dino, beast, baby, winged, and helmeted types do **not** get a tongue; they bow or turn the head, mouth closed.
5. **Sleep uses a unique rest body**, not a 90° rotate of idle. Dino child/adult/perfect: official checkered crib with the head poking out, same orientation. Babies: flattened blob. Quadrupeds: lying or huddled body (often shared with sick/hurt). Humanoids and megas: full-body lie, usually no crib. Eyes are a horizontal closed line, or hidden in the crib. Sleep1 is a 1 px shift of sleep0.
6. **Hurt is a slump or recoil, not X or swirl eyes.** Official classic DMC/PenC cells on this roster almost never use X or spiral pupils. Do not invent them. Sick often shares the sleep / lie body; the skull is an overlay, not a face redraw.
7. **Angry is an open roar with a normal or slanted eye, never ^^.** On official Agumon, angry is bit-identical to eat1 and attack.
8. **Open mouths are filled, never a cut-through to the background.** From Child (成長期) upward, official DMC/PenC open-mouth cells (happy / eat1 / angry / attack) have a dark outline and an interior color (red, pink, purple, or dark). Many also show white teeth and/or a pink or red tongue. Official Agumon is the notable Child-dino exception: a Pac-Man silhouette bite with only a dark jaw outline (the body is already yellow-orange, so there is no separate cavity color). Designed monsters in this project that are later-stage dinos follow Greymon / Tyranomon / Airdramon (filled interior + teeth), not Agumon's silhouette. Designed babies follow Koromon (filled red / pink + white teeth), not Poyomon's silhouette bite. Mouth interior may use the standard official mouth red / tongue pink even if that color is not in the idle sprite. Body and head colors otherwise stay exactly the idle palette — no face wash.

## Pose reuse by group

Group = growth stage × body type. Apply the group of the closest official analogue (Agumon for child biped dinos, Ogremon for adult humanoids, Garurumon for quadrupeds, Koromon for baby blobs, WarGreymon / Omegamon for armored megas).

### Baby I / II — blob (Koromon, Botamon; designed: Petitmon, Babydmon, Dodomon, Dorimon, Sakumon, Sakuttomon, Pukamon, Plotmon)

| Action | Body | Face |
|---|---|---|
| idle0 | frontal blob | dot / oval eyes, mouth closed or tiny |
| happy | **same frontal body** (not the angry lean) | **two ^^ arcs** + a large open mouth |
| eat0 / eat1 | frontal, maybe a small bob | open mouth, **normal eyes** (not ^^) |
| angry / attack / train | often a **shared profile / crescent lean** | slanted eye, open mouth, not ^^ |
| refuse | smaller or slightly lowered frontal | no tongue, mouth not a happy smile |
| sleep / sick / hurt | flattened rest body, often shared | horizontal closed-eye lines, not X |

### Child / Adult / Perfect — biped dino (Agumon, Greymon, Tyranomon, MetalGreymon; designed: Hackmon, Dracomon, Coredramon Blue/Green, LastTyranomon, Groundramon, Breakdramon, DORUguremon)

| Action | Body | Face |
|---|---|---|
| idle0 | standing | oval / tessera eye, mouth closed |
| idle1 | **walk only** | same face as idle0 |
| happy | **idle0 / eat body, standing** | open mouth + **^^ / chevron eye** |
| eat0 | same standing body, slight bob optional | **small** open mouth, normal eye |
| eat1 | same standing body | **larger** open mouth, normal eye |
| angry | **same cell as eat1** on official Agumon | open roar, normal or fierce eye, not ^^ |
| attack | same roar cell (child/adult) or a lunge (some perfect/megas) | same as angry when reused |
| refuse | **unique bowed / hunched body** | head down or averted, **no tongue** |
| sleep | **crib + head**, same head orientation | eye closed or hidden |
| hurt | unique slump / recoil | normal or slightly grimace, not X |

MetalGreymon (perfect, metal dino) follows this pattern: standing body reused for happy/eat/angry; happy is a visor/eye gleam rather than a fleshy oval; refuse is still a bow, no tongue; sleep is crib or a compact rest, not a helmeted stand.

### Child — small biped / beast (Gabumon, Coronamon, Lunamon, Zubamon)

Same face logic as the dino child: standing body reused, happy = open mouth + ^^, eat = open + normal eye, refuse = bow / sit-avert **without** tongue. Official Gabumon sleep is a sit/curl, not a crib; designed bipeds in this project already use the DMC crib + head and should keep that body, only closing the eye.

### Adult / Perfect / Ultimate — humanoid with a visible face (Ogremon, Leomon, Etemon; designed: Titamon, KingEtemon, Pinochimon, Flaremon, Apollomon, Lekismon, Crescemon, Dianamon, Meicrackmon, Rasielmon, GraceNovamon, BaoHuckmon)

| Action | Body | Face |
|---|---|---|
| happy | **idle standing body** | **^^ eyes** (if visible) + open smile |
| eat | same standing body | open mouth, normal eyes |
| angry / attack | same body or a slight lean / lunge | roar, teeth, fierce eyes, not ^^ |
| refuse / overfeed | **standing body** (not the dino bow) | **pink / red tongue out**, eyes normal or droopy |
| sleep | lie down, usually **no crib** | closed line eyes |
| hurt | slump | normal / grimace, not X |

Etemon / KingEtemon keep sunglasses; the mouth and tongue still change. Do not invent ^^ on top of opaque shades — smile and mouth do the work, with a gleam if a sliver of eye exists.

### Adult / Ultimate — quadruped (Garurumon, MetalGarurumon; designed: DORUmon, DORUgamon, Firamon, Meicoomon)

Eat / happy / angry / attack are mouth and eye edits on a standing or slightly leaning body. Happy may share the eat1 body and must still get ^^ (or a brow gleam). Refuse is close to idle, mouth closed, **no tongue**. Sleep / sick / hurt often share **one lying or huddled body** with closed eyes. Designed quad sleep already uses a huddle; keep that body and only close the eyes.

### Child / Adult — winged (Patamon, Biyomon / Birdramon; designed: Wingdramon, and winged megas below)

Standing body reused for happy/eat/angry when official cells allow it. Happy = ^^ or a bright eye gleam. Eat = open beak/mouth + normal eye. Refuse = head turned or bowed, no tongue. Sleep = rest / curl / lie, closed eyes. Official Patamon sometimes collapses eat1/happy/angry/attack into one cell; designed frames still **force ^^ on happy** so the action is readable.

### Ultimate — armored / visor / knight (WarGreymon, Omegamon, BlitzGreymon; designed: Alphamon, Jesmon, SaviorHuckmon, Slayerdramon, Examon, Duramon, Durandamon, ZubaEagermon)

Happy / eat / angry can still sit on the **standing** body. Happy is a **bright visor gleam** (yellow / white chevron), not a fleshy cartoon eye pasted on the helmet. Attack is often a real lunge — do not overwrite an official lunge. Refuse is helmeted, **no tongue**. Sleep is a **full-body lie**, usually no small crib (the designed crib can look cramped on huge mega heads; keep the existing designed sleep body in this pass and only close / hide the eye). Hurt uses the official slump when one exists; a designed hurt1 is a 1 px bob of that official hurt, same face.

### Egg (excluded from this face pass)

Eggs have no face. Designed egg frames stay tilts and hatch cracks. No invented eyes, mouths, or tongues.


## Mouth interiors (official census)

Survey of every official-color `happy` / `eat0` / `eat1` / `angry` / `attack` cell already in the atlas: **553 frames across 127 official DMC / PenC / artbook monsters**, compared to each monster's `idle0`, then visually audited.

Companion figures (working files, not shipped in the zip): `/tmp/pass12/official_mouths_x6.png`, `/tmp/pass12/side_mouths_x10.png`, `/tmp/pass12/hollow_candidates_x8.png`.

### Automatic counts (32-pixel cells vs idle0, head band)

An automatic classifier tagged a frame as *filled* when the head gained a cluster of red, pink, or dark interior pixels, and as a *hollow candidate* when a large head cut-to-background had little red/pink fill.

| Stage | Official open-mouth keys (happy/eat1/angry/attack) | Auto-filled | Auto hollow candidates | Frames with white teeth (≥8 px) |
|---|---:|---:|---:|---:|
| Baby I (幼年期Ⅰ) | 34 | 30 (88%) | 3 | 18 |
| Baby II (幼年期Ⅱ) | 30 | 28 (93%) | 2 | 23 |
| Child / Rookie (成長期) | 54 | 50 (93%) | 4 | 18 |
| Adult / Champion (成熟期) | 156 | 147 (94%) | 7 | 77 |
| Perfect / Ultimate (完全體) | 84 | 80 (95%) | 4 | 36 |
| Ultimate / Mega (究極體) | 58 | 49 (84%) | 4 | 9 |
| Super Ultimate (超究極體) | 10 | 8 (80%) | 2 | 10 |
| **All 553 keys (includes eat0)** | 553 | 487 (88%) | 46 (8%) | 244 (44%) |

Of the 487 auto-filled frames, 302 have a clear red interior (≥16 px), 148 have pink (≥8 px), 211 have white teeth (≥8 px), and 446 have dark lip/cavity pixels. Interior is often more than one of these at once (dark outline + red fill + white teeth, or red + pink tongue).

### Visual audit of every hollow candidate

All 46 auto-hollow frames were inspected at 8× against `idle0`. Almost every hit was a **false positive**:

- `eat0` is often a closed or nibble pose, or a different squat/lean, not an open mouth (Botamon, Centalmon, Coelamon, Digitamamon, Drimogemon, Kabuterimon, Kunemon, Tanemon, Yukidarumon, Yuramon, Zurumon, Giromon, MetalGarurumon).
- Weapon / lunge cells reused in eat/attack slots: Duramon, Durandamon, Zubamon, ZubaEagermon, Tuskmon (tree pose). These are not mouths.
- Dark-filled mouths the classifier missed because the interior was already near-black (Gazimon, Raremon).
- Visor / armored faces with no fleshy open mouth (Jesmon, Omegamon).

**Genuine unfilled silhouette open mouths** found in official cells:

- **Poyomon** (Baby I) `eat1` / `angry` / `attack`: a bite taken out of the blob, background showing through. Poyomon `happy` is filled (red + white).
- **Agumon** (Child dino): Pac-Man bite at the snout tip, dark jaw outline, no separate red cavity (the body is already yellow-orange). The automatic classifier tagged these as filled because the orange body registered as “red.”

No other Child-or-later official cell that actually shows an open mouth was a hollow cut-through. Official examples with a clearly filled interior include Ogremon, Leomon, Etemon, Devimon (humanoid / beast-man, red + teeth), Greymon (white teeth in the opening), Tyranomon (dark cavity), Airdramon and Seadramon (red between the jaws), Gabumon and Garurumon (pink / red), Patamon (red + white teeth), Betamon (red, teeth on angry), Kabuterimon / Kunemon (purple), Digitamamon (purple / red + teeth), Koromon and Punimon (red / pink + white).

### Interior recipe by group (designed frames follow this)

| Group | Official analogue | Outline | Interior | Teeth | Tongue | Notes |
|---|---|---|---|---|---|---|
| Baby I / II blob | Koromon, Punimon | dark | official mouth red + pink lip | white highlights in the cavity (Koromon) | pink / red on the bottom lip or inside | Designed babies use this, **not** Poyomon's silhouette bite. |
| Child dino | Agumon is silhouette-only; **Greymon / Tyranomon / Airdramon** for later-stage designed dinos | dark jaw | red or deep red (dark cavity if the body is already red, as on Tyranomon) | white on eat1 / angry / attack (Greymon), also happy when the jaw is wide | no | Designed dinos in this project (Hackmon, Dracomon, Coredramon, LastTyranomon, Groundramon, Breakdramon, DORUguremon, …) follow Greymon / Airdramon, not Agumon's hollow bite. |
| Child / adult beast, quadruped | Gabumon, Garurumon | dark | pink / red | usually none | pink often visible in the open snout | Refuse stays closed, no tongue. |
| Humanoid / beast-man | Ogremon, Leomon, Etemon | dark | official mouth red | white on eat1 / angry / attack (Ogremon); happy is a red smile without teeth | pink / red on refuse (tongue out); some eat/angry mouths also show a tongue | Never a transparent or plain-black hole. |
| Winged | Patamon, Airdramon, Birdramon | dark | red | white when official shows them (Patamon) | no | Beak / jaws still get a filled interior. |
| Insect / plant | Kunemon, Kabuterimon, Palmon | dark | often purple or red | rare | no | If the idle has no purple, use official mouth red. |
| Aquatic | Betamon, Seadramon, Coelamon | dark | red or dark | sometimes (Betamon angry) | no | |
| Armored / visor / knight | WarGreymon, Omegamon, Jesmon | dark (visor edge) | small filled slit if a mouth is visible | no fleshy teeth | no tongue | Do not punch a hole through the helmet. Many official eat/attack cells are lunges or weapons, not mouths. |

### Standard official mouth colors (allowed even when absent from idle)

Sampled from official 32×32 cells (Ogremon, Koromon, Greymon, Airdramon). These may be used **only** for mouth interior, lips, tongue, and teeth. The rest of the sprite must keep the idle palette.

| Role | RGBA | Source |
|---|---|---|
| Mouth red | `(165, 36, 8, 255)` | Ogremon / common cavity |
| Deep mouth red | `(123, 20, 0, 255)` | Ogremon lip / depth; also used when the body is already red so the cavity still contrasts |
| Tongue / lip pink | `(230, 174, 197, 255)` | Koromon tongue / pink fill |
| Teeth white | `(248, 248, 248, 255)` | Ogremon / Greymon / Koromon teeth |
| Outline | the monster's existing dark outline | never a new outline color |

If the idle already contains a red or pink, prefer that existing color for the cavity or tongue, provided it still reads against the face. If the body fill is itself close to mouth red (e.g. LastTyranomon), use deep mouth red and teeth so the opening does not melt into the head.

## How designed frames are rebuilt

Only keys whose coverage kind is `designed` are rewritten. `official_color` (and any designed key that is already pixel-identical to an official color cell, except happy) is left untouched.

- **happy** — copy official `eat1` / `eat0` / `angry` if one exists (standing open-mouth body), otherwise open the mouth on `idle0`. The opening is an outlined cavity **filled with mouth red / pink / deep red** (plus teeth where the group table says so), never a transparent cut-through or a plain black hole. Then replace the eye with ^^ or a visor gleam. No jump, no arm raise, no new silhouette.
- **eat0 / eat1** — only when designed: `idle0` body, small vs larger **filled** open mouth, **normal eyes**. eat1 may show teeth on dino / humanoid / baby groups.
- **angry** — only when designed: prefer a direct copy of official `eat1` / `eat0` (official Agumon identity). Otherwise a filled open-mouth `idle0` with a normal / fierce eye, not ^^, and not a lowered “new stance.” Teeth per the group table.
- **refuse** — humanoid with a visible face: official `idle0` + a filled mouth and official-pink tongue. All other groups: keep the existing bowed / averted designed body (or bow `idle0` if needed), mouth closed, no tongue.
- **attack** — only when designed and no official attack: same filled roar as angry, or a slight lunge, normal / slanted eye, not a helmet hole.
- **sleep0 / sleep1** — keep the designed rest body (crib, huddle, flatten, lie). Only close the visible eyes. sleep1 stays a 1 px shift of sleep0.
- **hurt / hurt1** — if official hurt exists, designed hurt1 is a 1 px shift of that official cell. Otherwise a slump of idle with a normal or slightly closed eye, never X / swirl.
- **attack** — only when designed and no official attack: same filled roar as angry on a standing body or a slight lunge, normal / slanted eye. Never a transparent mouth or a hole punched through a visor.

## Honest limits

- 16-grid (then ×2 to 32) cannot copy every 48×48 sub-pixel of an official teal chevron. The ^^ must still read as an inverted-U, not a leftover oval.
- Visor knights (Alphamon, Jesmon, Examon, …) have no true eye; the gleam is the official-style substitute and can be subtle.
- Designed mega sleeps still use the earlier crib / lie bodies; this pass does not restage them.
- Quad sleep remains a huddle, not a full official Garurumon side-lie.
- Artbook monsters only have four official color poses (idle A/B, action, hurt). eat0/eat1 may be the same official cell. This pass does not invent a second official chew or reshuffle official mappings.
- Some official cells collapse poses (eat1 = angry = attack). Designed happy is still forced to show ^^ so the user-facing action is distinct.
