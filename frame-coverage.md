# Frame coverage

Official color cells are used as-is (no recolor, no retouch). Official monochrome cells keep the earlier colorization. Designed frames in this pass are 16-grid redraws following official DMC/PenC conventions (biped sleep = recognizable head in the official-style crib; quadruped sleep = huddled rest with closed eyes; baby sleep = settled blob with closed eyes; egg = tilt / hatch cracks). Rotated or squashed-idle poses were removed. Designed expression frames (happy / eat / refuse / angry / sleep / hurt) were then rebuilt to follow official DMC/PenC face logic: same body pose, inverted-U (^^) happy eyes, eat vs happy mouth/eye difference, tongue-out refuse on humanoids, closed-line sleep eyes, no invented X/swirl hurt. Official color cells were not retouched. See `expression-rules.md` and `expression-study.png`.


## Totals (primary keys, all 145 monsters)

- `official_color` (官方彩色): 1430
- `designed` (自製): 423
- `kept` (既有): 30
- `kept_existing_idle` (既有上色／既有): 17

## The 59 that previously relied on designed poses

After this pass (primary keys only):
- `designed` (自製): 453
- `official_color` (官方彩色): 312
- `kept_existing_idle` (既有上色／既有): 17

Official DM20 artbook color cells were found for **42** of these 59 (4 poses each: idle A/B, action/attack, hurt). Source: `ref/tsr/dm20_ver20th.png` (Digital Monster Ver.20th Artbook rip by airshuffler). These replace designed or colorized cells and are used as-is.

Not found (still designed except existing idle): `egg_v1`, `egg_v2`, `egg_v3`, `egg_v4`, `egg_v5`, `lasttyranomon`, `pukamon`, `egg_zuba`, `egg_hack`, `egg_dra_blue`, `egg_dra_green`, `egg_doru`, `egg_anime_agumon`, `egg_anime_gabumon`, `egg_corona`, `egg_luna`, `egg_meicoo`.

Wikimon DM20/Pen20 GIFs for these monsters are almost all single idle frames (already in use). The TSR Pen20 sheet is empty placeholders. tero0x has no Bandai official pose dumps for them (only fan sets, which were not used). DMC Xros Wars sheet has a different roster. BEMemory/VB dumps were not used (different resolution/style).

## Per-monster tags

| id | name | idle0 | idle1 | eat0 | happy | angry | refuse | sleep0 | attack | hurt | plan |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `egg_v1` | 版本一數碼蛋 Ver.1 Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_v2` | 版本二數碼蛋 Ver.2 Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_v3` | 版本三數碼蛋 Ver.3 Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_v4` | 版本四數碼蛋 Ver.4 Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_v5` | 版本五數碼蛋 Ver.5 Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `kingetemon` | 大王悟空獸 KingEtemon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `titamon` | 泰坦獸 Titamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | biped |
| `pinochimon` | 木偶獸 Pinochimon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `lasttyranomon` | 終極巨龍獸 LastTyranomon | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | biped |
| `sakumon` | 薩庫獸 Sakumon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | 官方彩色 | baby |
| `sakuttomon` | 薩庫托獸 Sakuttomon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | 官方彩色 | baby |
| `zubamon` | 茲巴獸 Zubamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `zubaeagermon` | 茲巴伊戈獸 ZubaEagermon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `duramon` | 杜蘭獸 Duramon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `durandamon` | 杜蘭達獸 Durandamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `hackmon` | 哈克獸 Hackmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `baohackmon` | 刃王哈克獸 BaoHuckmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `saviorhackmon` | 救星哈克獸 SaviorHuckmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `jesmon` | 傑斯獸 Jesmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `petitmon` | 小龍獸 Petitmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | 官方彩色 | baby |
| `babydmon` | 幼龍獸 Babydmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | baby |
| `dracomon` | 龍仔獸 Dracomon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `coredramon_blue` | 核龍獸 (藍) Coredramon (Blue) | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `coredramon_green` | 核龍獸 (綠) Coredramon (Green) | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `wingdramon` | 翔龍獸 Wingdramon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `slayerdramon` | 斬龍獸 Slayerdramon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | biped |
| `groundramon` | 地龍獸 Groundramon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `breakdramon` | 破壞龍獸 Breakdramon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `examon` | 艾克薩獸 Examon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `dodomon` | 多多獸 Dodomon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 官方彩色 | 官方彩色 | 官方彩色 | baby |
| `dorimon` | 多利獸 Dorimon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | 官方彩色 | baby |
| `dorumon` | 多路獸 DORUmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | quad |
| `dorugamon` | 多路加獸 DORUgamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | quad |
| `doruguremon` | 多路龍獸 DORUguremon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `alphamon` | 阿爾法獸 Alphamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `pukamon` | 布加獸 Pukamon | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | baby |
| `coronamon` | 日冕獸 Coronamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `firamon` | 焰獅獸 Firamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | quad |
| `flaremon` | 耀獅獸 Flaremon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `apollomon` | 阿波羅獸 Apollomon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `lunamon` | 露娜獸 Lunamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `lekismon` | 雷克斯獸 Lekismon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `crescemon` | 新月獸 Crescemon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `dianamon` | 狄安娜獸 Dianamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `gracenovamon` | 優雅新星獸 GraceNovamon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 官方彩色 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `plotmon` | 小狗獸 Plotmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | baby |
| `meicoomon` | 緬因貓獸 Meicoomon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | quad |
| `meicrackmon` | 緬破獸 Meicrackmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `rasielmon` | 拉結爾獸 Rasielmon | 官方彩色 | 官方彩色 | 官方彩色 | 自製 | 自製 | 自製 | 自製 | 官方彩色 | 官方彩色 | biped |
| `egg_zuba` | 茲巴數碼蛋 Zuba Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_hack` | 哈克數碼蛋 Hack Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_dra_blue` | 龍仔獸藍蛋（斬龍） Slayerdra Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_dra_green` | 龍仔獸綠蛋（破壞龍） Breakdra Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_doru` | 多路數碼蛋 Doru Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_anime_agumon` | 動畫亞古獸數碼蛋 Anime Agumon Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_anime_gabumon` | 動畫加布獸數碼蛋 Anime Gabumon Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_corona` | 日冕數碼蛋 Corona Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_luna` | 露娜數碼蛋 Luna Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |
| `egg_meicoo` | 梅可可數碼蛋 Meicoo Digitama | 既有上色／既有 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | 自製 | egg |

## Self-assessed weak designed frames

Official color frames (artbook / DMC / PenC / wiki color) look correct and were not retouched.

Remaining designed frames are coherent 16-grid redraws, not 90° shattered sleeps or squashed refuses. Honest weak spots:

- **Happy** is often a slight lift plus an open mouth, not always a clear arms-up jump. Arm segmentation at 16px is unreliable on armored megas (Titamon, Examon, LastTyranomon).
- **Quad sleep** (Dorumon, Dorugamon, Firamon, Meicoomon) is a huddled/settled rest with closed eyes, in the spirit of official Gabumon sleep — not a full Garurumon side-lie. Better than a rotated shatter, but less horizontal than official Garurumon.
- **Bed sleep on large megas** (Titamon, Examon, Jesmon, Alphamon, Hackmon line) can look cramped: the official DMC crib is small, and a large head fills it. The pose is still a recognizable head in a bed, which is the DMC convention for bipeds (Greymon / Tyranomon).
- **LastTyranomon** and **Pukamon** have no artbook poses; eat / attack / refuse / happy / sleep are entirely designed from the existing idle.
- **Eggs** have no official pose set beyond the idle wobble. Designed frames are tilts, a 1px rest, and hatch cracks — they stay eggs, with no invented faces.
- **Petitmon / baby** official attack (wide-open mouth) and official lying sleep are good. Designed happy / angry / refuse on such a tiny sprite are necessarily small edits.
- Designed **eat** (when no official open-mouth cell) is a punched mouth hole on the idle stance; readable, but less refined than official eat cells.
