# V-pet 動畫研究：角色格 vs 共用圖示

研究日期：2026-11-12（Asia/Taipei）。本文件只做調查，尚未改遊戲幀或 UI。

目的：弄清楚原版 Digital Monster Ver.1–5、Digital Monster COLOR（DMC）、Digital Monster Ver.20th（DM20 / Digimon Original）上，哪些反應是「每隻怪物自己的點陣格」，哪些是「同一隻怪物的格＋共用圖示／特效」。遊戲必須跟原機一樣：有官方格就用官方格；原機用圖示的地方用官方風格圖示疊加，不要發明位移／翻轉 idle 來冒充動作。

---

## 0. 一句結論

- **每隻怪物都有一套自己的動作格**，不是只有 idle。經典單色機（原版 DM、Pendulum、DMX、以及 DM20 所繼承的那套）是 **12 格**；DMC 是 **15 格**；Pendulum Color 是 **12 格**（配置與經典單色機相同家族，但吃／睡順序不同）。
- **愛心計量、食物、便便、Z／Zz、骷髏、訓練牆／計量、攻擊彈／命中閃、墓碑、螢幕邊框的 8 個功能圖示** 都是 **共用圖層**，不是畫進該隻怪物的角色格裡。
- 官方角色格裡 **沒有** 畫上愛心、怒氣符號、Z、骷髏或肉（已用官方 DMC／PenC 亞古獸實格核對）。睡眠格是真正的躺姿；DMC 的睡眠格還包含一張藍色小床，那是角色格的一部分，不是獨立圖示。
- 一個「反應」常常是 **兩張角色格輪播＋一張共用圖示**（例如睡眠 = sleep1／sleep2 ＋ 頭上的 Z；受傷在主畫面 = 角色格＋旁邊飄的骷髏；拒絕進食 = refuse 格，經典機還會左右翻轉做出搖頭）。
- 本專案先前用「把 idle 平移／翻轉」做出來的 eat／happy／angry／sleep／attack／hurt **不能代表官方動畫**，必須改為官方格＋官方式圖示。

---

## 1. 各機種：真正的怪物角色格

### 1.1 原版 Digital Monster Ver.1–5，以及 Ver.20th（單色 LCD）

 Pendulum 與 Digital Monster X **公式設定集**把每隻怪物的點陣列成固定 12 格。With the Will 討論串裡 Tortoiseshel 依這兩本公式書列出的順序是（排成 4×3 只是整理方式，書上是一列）：

| 序 | 角色格 | 用途 |
| --- | --- | --- |
| 1–2 | Walk 1, Walk 2 | 主畫面走動／待機（兩格輪播；角色在畫面上左右走動） |
| 3–4 | Eat 1, Eat 2 | 進食（閉口／開口輪播）。\*Eat 2 也會被用進 Happy 動畫 |
| 5–6 | Sleep 1, Sleep 2 | 睡眠（躺姿輪播） |
| 7 | Refuse | 拒絕（食物／治療）。\*\*也會被用進 Angry 與 Attack 動畫 |
| 8 | Happy | 高興（訓練成功、戰後等） |
| 9 | Angry | 生氣／輸掉小遊戲或戰鬥後的表情 |
| 10–11 | Injured 1, Injured 2 | 受傷／敗北姿勢 |
| 12 | Attack | 攻擊 |

來源：[With the Will「Full Color Digimon Dot Sprites」第 2 頁](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/page-2)（Tortoiseshel：「It's the same order that they're are listed in in the Pendulum and Digital Monster X art books」）。

Reddit 上有人拿同一套 12 格還原播放規則，與公式書順序一致，可作為「怎麼播」的補充（非正式說明書，但與實機習慣吻合）：

- 進食：Eat 1／Eat 2 輪播
- 拒絕：Refuse **左右鏡像來回**，做出搖頭
- 睡眠：Sleep 1／Sleep 2 輪播，並叠 **大／小 Z 圖示**
- 生氣：Angry 與 Walk 1 輪播
- 戰鬥：Attack 與 Walk 1
- 負傷／倒下：Injured 1／Injured 2 輪播
- 閒置走動：Walk 格在畫面上移動（不是垂直跳一下）

來源：[r/digimon「what these old digimon sprites represent」](https://www.reddit.com/r/digimon/comments/1tf5qkk/please_help_me_figure_out_what_these_old_digimon/)

**Ver.20th** 是原版系列的重製（Wikimon：[Digital Monster Ver.20th](https://wikimon.net/Digital_Monster_Ver.20th)；Humulos 稱之為 Digimon Original）。The Spriters Resource 有一份官方風格的全集點陣表：

- [Digimon Digital Monster Ver. 20th — asset 148724](https://www.spriters-resource.com/lcd_handhelds/digimondigitalmonsterver20th/asset/148724/)，864×1650 PNG，上傳者 airshuffler，2021-02-15。註解明確寫先前誤傳的「模擬器偷竊圖」已撤下，這份才是真機圖。

本次 **未能下載到該 PNG 本體**（見第 6 節），因此還沒有逐格點算 DM20 表；但機種定位與公式書 12 格傳統一致，應先按 12 格＋共用圖示來對，等拿到表再做逐格核對。

原版 1997 機的社群拆圖也把 **共用 bits** 與 **怪物 bits** 分成兩張表（With the Will「Information required」，2010 年代 rips：`shared*.gif` vs `monsters*.gif`，見 [該串](https://withthewill.net/threads/information-required.6916/)）。舊圖床多半已失效，但「共用圖層與角色格分開」這件事在原版機就成立。

Wikimon 上的 `File:<Name> vpet dm.gif`／`… dm20.gif` 幾乎都只有 **1–2 格待機**，不是完整 12 格。本專案 `ref/wikimon/` 現有 234 個 gif／png：129 個 1 幀、105 個 2 幀、**沒有任何超過 2 幀的檔**。Wikimon [Category:V-Pet Sprites](https://wikimon.net/Category:V-Pet_Sprites)（本次 API 列出 4540 個檔）同樣幾乎是待機／cut-in，不是 eat／sleep／attack 全套。

### 1.2 Digital Monster COLOR（DMC）— 15 格，彩色，官方韌體

DMC 是 Ver.1–5 的彩色重製。每隻可養成怪物在韌體裡有 **15 張 48×48（16 格 ×3）角色格**。官方模版與韌體匯出的槽位一致：

```
idle_1, idle_2, happy, angry,
train_1, train_2, atk_1, atk_2,
eat_1, eat_2, refuse,
sleep_1, sleep_2, sick, lose
```

來源：

- 官方模版 [csx.sh/dmc/DMColorSpriteTemplate.png](https://csx.sh/dmc/DMColorSpriteTemplate.png)（直向 15 槽，標註 IDLE／HAPPY／ANGRY／TRAINING×2／ATTACKING×2／EATING×2／REFUSING／SLEEP×2／SICK／SICK-LOSE）
- `vpet_formats.dmc`：[tero0x/dmc-sprites sprites.json](https://tero0x.github.io/dmc-sprites/sprites.json)（資料庫標註 author = Bandai，source =「Digimon Color Ver. 1–5」等；Ver.1–5 合計約 94 筆、每筆 15 圖）
- 改機說明 [csx.sh/posts/dmcmod](https://csx.sh/posts/dmcmod/)：DMC 要 15 張；**走路循環用 IDLE 1、IDLE 2 與 ATTACKING 2**；進食必須「先閉口、再開口」（與 PenC 相反）

本次實際下載並逐格查看 **DMC Ver.1 官方亞古獸**（`images/original/dmc/v1/240.png`–`254.png`）：

| 槽 | 看見的內容 | 格內有沒有圖示？ |
| --- | --- | --- |
| idle_1／idle_2 | 站姿／重心轉換的走動兩格 | 無 |
| happy | 嘴微張、表情開朗 | **無愛心** |
| angry | 眉壓低、嘴抿／不悅 | **無怒氣符號** |
| train_1／train_2 | 訓練用打擊姿勢 | 無牆、無計量條 |
| atk_1／atk_2 | 攻擊姿勢（atk_2 張口更明顯） | 無彈道、無命中閃 |
| eat_1／eat_2 | 站著吃：閉口 → 張口 | **無肉、無蛋白質** |
| refuse | 低頭／縮身拒絕 | 無叉號 |
| sleep_1／sleep_2 | **躺在藍色小床裡**，閉眼，兩格微差（呼吸） | **無 Z**；床是這張角色格的一部分 |
| sick | 蹲低、沒精打采 | **無骷髏** |
| lose | 站著虛弱／受傷姿勢 | **無骷髏** |

對本專案：DMC 血統的怪物（Ver.1–5 彩色官方點陣）應使用這 15 格裡對應的官方彩色像素（48＝16×3，取 16 再 ×2 放到 32，整數倍、不重畫、不修圖）。訓練牆、食物、Z、骷髏另外叠。

### 1.3 Pendulum Color（DPC / PenC）— 12 格，彩色

PenC 官方模版 [csx.sh/dmc/PenColorSpriteTemplate.png](https://csx.sh/dmc/PenColorSpriteTemplate.png) 為 4×3：

```
idle_1, idle_2, eat_1,
eat_2, sleep_1, sleep_2,
refuse, happy, angry,
sick, lose, atk_2
```

與 `vpet_formats.penc` 相同。沒有獨立的 train_1／train_2，攻擊只有 atk_2。csx.sh 註明：PenC 進食順序與 DMC **相反**（先開口、再閉口）。

本次查看 **PenC Virus Busters 官方亞古獸** 12 格：吃、躺睡、拒絕低頭、張嘴高興、咬牙生氣、無力 sick、佝僂 lose、張嘴攻擊，皆為真正重繪姿勢。睡眠格是側躺，**沒有** DMC 那種小床；一樣 **沒有** Z／骷髏／食物畫在格內。

DPC 84×84 的 Wikimon 檔（如 `Lunamon vpet dpc.gif`、`Titamon vpet dpc.gif`）是裁切過的待機動畫（本庫為 2 幀），且 84 不是 32 的整數倍，不能當 32 格原樣使用。完整 12 動作要以 PenC 的 48×48（16×3）官方格為準（若該隻在 PenC 韌體／官方表裡）。

### 1.4 本專案幀鍵建議對照

| 本專案鍵 | 官方格（優先 DMC，其次 PenC／DM20 12 格） | 另外要叠的共用圖示 |
| --- | --- | --- |
| idle0／idle1 | idle_1／idle_2（走動，在畫面橫移，不要做垂直 hop） | 無。DMC 閒置循環還會用到 atk_2（見 csx.sh） |
| eat | eat_1／eat_2 輪播（注意 DMC vs PenC 開閉口順序） | **食物（肉／蛋白質）** 出現在怪物旁邊 |
| happy | 官方 happy 格（經典機還可能交織 Eat 2） | 愛心圖示：**尚未找到說明書明文**；官方 happy 格本身沒有愛心 |
| angry | 官方 angry 格（經典機可能交織 Refuse 或 Walk 1） | 怒氣符號：同樣未在說明書看到必須；格內沒有 |
| refuse | 官方 refuse；經典機可左右翻轉搖頭 | 無（或被拒絕的那塊食物留在旁邊） |
| sleep | sleep_1／sleep_2（躺姿；DMC 含官方小床） | **頭上的 Z／Zz**；關燈後畫面變暗（燈光功能，不是角色格） |
| attack | atk_2（DMC 另有 atk_1 做揮擊／蓄力） | 共用攻擊彈／命中效果（DMC 另有一組攻擊特效圖，不是這 15 格） |
| hurt | lose 與／或 sick（受傷姿勢） | 主畫面受傷時 **旁邊飄骷髏**（見下節） |

沒有官方來源的怪物，自製動作也必須照上述「真實姿勢慣例」（張嘴吃、躺著睡、掉頭拒絕……），再叠同一套圖示，禁止只把 idle 平移充數。

---

## 2. 共用圖示／特效（不是角色格）

下列在說明書或官方格目視中，都是 **所有怪物共用、叠在角色旁邊或畫面上** 的元素。

| 元素 | 原機怎麼用 | 來源 |
| --- | --- | --- |
| 螢幕邊框 8 個功能圖示（體重計、肉、訓練、對戰、便便、燈光、繃帶、呼叫） | 機殼／UI 選單，不是怪物動畫 | Wikimon [Digital Monster](https://wikimon.net/Digital_Monster)；[FileIsland V-pet intro](https://lcd.withthewill.net/VpetIntro) |
| 飢餓／力量 **愛心槽** | 狀態畫面的計量，不是高興動畫 | 同上；Humulos DM20／DMC 手冊 Status |
| **食物**（肉、蛋白質） | 餵食時出現在畫面上；角色用 eat 格去吃它 | 手冊 Food；官方 eat 格內沒有食物像素 |
| **便便** | 獨立堆在畫面上，用廁所／清理圖示清掉；堆積會導致受傷 | Humulos DMC／DM20「Clean Waste (Poop Icon)」；Wikimon Toilet |
| **Z／Zz** | 睏了或睡著時在 **頭上**。DM20 手冊原文：tired「is indicated by it having Z's above it's head」。睡眠動畫是躺姿格＋Z | [Humulos DM20 Manual](https://humulos.com/digimon/dm20/manual/)；Reddit 12 格還原（大小 Z 交替） |
| **骷髏** | 受傷時「**a skull floating next to it**」，再用繃帶治療。角色的 sick／lose 格本身沒有骷髏 | [Humulos DMC Manual](https://humulos.com/digimon/dmc/manual/)、[DM20 Manual](https://humulos.com/digimon/dm20/manual/) Heal 節 |
| DMX 的 **Dots vs Skull** | Dots＝生病，Skull＝受傷，兩種都是狀態圖示 | [Humulos DMX Manual](https://humulos.com/digimon/dmx/manual/)（本專案主線不是 DMX，僅作對照） |
| 關燈／畫面變暗 | 睡著後要關燈，否則算照顧失誤。Wikimon DM20 有「asleep without a blanket」的措辭，較像在說沒關燈／沒進入睡眠照顧，**沒有找到獨立「被子」角色格** | Wikimon Ver.20th；Humulos Sleep (Light Bulb Icon) |
| 訓練牆／計量／高低射擊與盾 | 訓練小遊戲的舞台與 UI。DMC **另外** 還有 train_1／train_2 角色格 | Humulos DM20 Training（按 A 填計量；雙人高低射）；DMC 15 槽模版 |
| 攻擊彈、命中閃 | 戰鬥特效。DMC 改機工具把「Main Attack Sprite」編成與角色格分開的特效編號（約 1–117） | csx.sh/posts/dmcmod；戰鬥命中率公式在 Humulos 手冊，不描述彈道美術 |
| 墓碑 | 死亡後共用墓碑（可能再留下特性蛋） | Humulos DMC／DM20 Death／Traited Egg |
| 呼叫燈 | 邊框 Call 圖示亮起，不是怪物格 | Wikimon；Humulos |

主畫面閒置：Humulos（DMC 與 DM20）都寫 Digimon 會在畫面上移動、做一些「只是好看、本身沒有意義」的動畫。那是用現有角色格（走動／偶爾其他格）移動，不是新的情緒狀態。

---

## 3. 裝置之間的差異（不要混用規則）

| | 原版 DM Ver.1–5 | DM20（Ver.20th） | DMC | PenC |
| --- | --- | --- | --- | --- |
| 角色格數 | 與後來公式書 12 格傳統一致（見 1.1；本次未獨立數 1997 ROM） | 應為同一 12 格家族；TSR 有全集表但本次未取得像素 | **15**（多了 train×2、atk×2，sick／lose 分開） | **12**（無 train 格，攻擊只有 1 張） |
| 色 | 單色 LCD | 單色 LCD | 官方彩色 16×3 | 官方彩色 16×3 |
| 睡眠 | 躺姿格＋Z | 躺姿格＋頭上 Z；關燈 | 躺姿格（含官方小床）＋應叠 Z | 躺姿格（無小床）＋應叠 Z |
| 進食開閉口 | Eat 1／2 | 同左 | 先閉後開 | 先開後閉 |
| 走路 | Walk 1／2 橫移 | 同左 | idle_1／idle_2 **加上 atk_2** | idle_1／idle_2 |
| 受傷顯示 | 受傷格＋（機種慣例的）骷髏 | 「骷髏飄在旁邊」 | 同左；另有 sick／lose 兩格 | 同左 |

Vital Bracelet、DMUL、以及 tero0x 資料庫裡 author 不是 Bandai 的「Hi-res／mod」圖，都不是本專案要跟的 V-pet 點陣（風格與格數不同）。

---

## 4. 對本專案現況的含義

1. **不要再把 idle 平移／翻轉／整圖加暗當作 eat、happy、angry、sleep、attack、hurt。** 那不是原機在做的事。
2. **有官方彩色格（DMC／PenC 48＝16×3）就原樣取用**（整數縮到 32），不重上色、不修邊。
3. **只有單色官方格的**，保留官方黑點排列，按 `official-color-style.md` 上色；動作格用該隻 idle 的同一套色盤。
4. **完全沒有官方點陣的動作**，才允許新畫，且必須是「張嘴、躺下、掉頭」這類真實姿勢，再叠同一套圖示。
5. **圖示層**（食物、Z、骷髏、便便、訓練牆、攻擊特效）應做成與怪物無關的共用精靈，主畫面受傷＝角色格＋飄骷髏，睡眠＝躺姿＋Z，而不是只在 idle 上畫 Zz（本專案舊 UI 的缺失正在這裡）。
6. idle 的「第二格」在原機是走姿，不是往上跳。之後接線時應拿掉對官方彩圖 idle1 的 hop，改為橫向走動。

---

## 5. 來源清單與本次取用結果

| 來源 | 結果 |
| --- | --- |
| [tero0x/dmc-sprites](https://tero0x.github.io/dmc-sprites/sprites.json)（Bandai、Digimon Color Ver.1–5、Pendulum Color 0–5） | **成功**。取得格式表與官方亞古獸全格 PNG，用於目視「圖示有沒有畫進角色格」。完整 roster 下載與接線 **尚未做**（依指示先完成研究）。 |
| [csx.sh DMC／PenC 模版與改機說明](https://csx.sh/posts/dmcmod/) | **成功**。模版 PNG 與 15／12 槽、走路／進食規則。 |
| [Humulos DM20 手冊](https://humulos.com/digimon/dm20/manual/)、[DMC 手冊](https://humulos.com/digimon/dmc/manual/)、[DMX 手冊](https://humulos.com/digimon/dmx/manual/)、[DMC 進化指南](https://humulos.com/digimon/dmc/) | **成功**。Z、骷髏、便便、訓練計量、關燈、主畫面閒置移動等，均有明文。Humulos 站上「Digital Monster 1997 / User Manual」導覽存在，但 `https://humulos.com/digimon/dm/manual/` 等常見路徑回 404，本次沒有獨立的 1997 手冊正文。 |
| Wikimon：[Digital Monster](https://wikimon.net/Digital_Monster)、[Ver.20th](https://wikimon.net/Digital_Monster_Ver.20th)、[COLOR](https://wikimon.net/Digital_Monster_COLOR)、[Category:V-Pet Sprites](https://wikimon.net/Category:V-Pet_Sprites)（API 4540 檔） | **成功（頁面／API）**。確認邊框圖示與照顧規則；vpet 檔幾乎只有 1–2 幀待機，不是全動作。 |
| 本機 `ref/wikimon/` 234 檔 | 已清點：0 個檔超過 2 幀。 |
| [The Spriters Resource Ver.20th 864×1650](https://www.spriters-resource.com/lcd_handhelds/digimondigitalmonsterver20th/asset/148724/)；[DMC 遊戲頁（7 份表，含 Version 1–5 等）](https://www.spriters-resource.com/lcd_handhelds/digitalmonstercolor/)；[Pendulum Color](https://www.spriters-resource.com/lcd_handhelds/digimonpendulumcolor/) | **頁面元資料看得到，PNG 本體被擋。** 嘗試：`curl`（一般瀏覽器 UA）、直接猜 `resources/sheets/`、`media/sheets/`、`cdn.spriters-resource.com`、`is/sheets/`；一律 Cloudflare 403（`cf-mitigated: challenge`）。WebFetch 能讀資產頁（圖示、尺寸、上傳者），「Page image」只是縮圖（例如 `/media/asset_icons/146/148724.png`），不是 864×1650 表。Archive.org 搜尋沒有找到可用的轉存複本。 |
| [With the Will 公式書 12 格順序](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/page-2)、[20th 設定集掃描介紹](https://withthewill.net/threads/digimon-20th-anniversary-digital-monster-art-book-ver-1-5-20th-breakdown-scans.19700/)、[舊共享／怪物拆圖討論](https://withthewill.net/threads/information-required.6916/) | **成功（討論與引用）**。20th 設定集頁面確認書中有 Ver.1–5 與 20th 的點陣，但本次沒有逐頁掃描檔。 |
| [Reddit 12 格播放還原](https://www.reddit.com/r/digimon/comments/1tf5qkk/please_help_me_figure_out_what_these_old_digimon/) | **成功**。當作播放規則的輔助，不是官方手冊。 |
| Wikimon／Fandom 的「每隻怪物全部動作 GIF」 | 未找到可取代 DMC／TSR 表的全動作官方 GIF 集。 |
| 實機遊玩影片 | 本次以手冊＋官方格＋公式書為主，沒有逐格看影片。頭上 Z、旁邊骷髏已有手冊原文，不依賴影片。 |

研究用截圖（不進發行包，僅在本機 `ref/research/`）：`agumon_dmc_sheet.png`、`agumon_dmc_closeup.png`、`agumon_penc_sheet.png`、`agumon_penc_closeup.png`，以及兩張官方模版。

---

## 6. 仍須核對的缺口（誠實列出）

- **TSR Ver.20th／DMC／PenC 總表像素尚未入手**（Cloudflare）。拿到後應逐隻核對 12／15 格切分，並與 tero0x Bandai 匯出交叉比對。
- **原版 1997 ROM 的精確格數**尚未獨立計數；目前依 Pendulum／DMX 公式書 12 格與 20th 重製關係推論。
- **高興時是否另外飄愛心、生氣是否另外有怒氣符號**：官方角色格裡沒有；說明書沒有寫死。實作時應先播官方 happy／angry 格；若之後用實機或影片確認有小圖示，再加共用圖層，不要把圖示畫進角色格。
- **DMC 攻擊特效圖**的具體圖像尚未收集（只知與角色格分開編號）。
- **Wikimon「blanket」用詞**是否對應任何被子精靈：目前沒有證據，傾向當作關燈／睡眠照顧的表述。
- **蛋的孵化幀**：Wikimon／本庫的 Digitama 多為 1–2 幀晃動；完整破殼是否另有官方格，待拿 DMC／DM20 表後再確認。
- Lunamon／Meicoomon 等「官方彩圖能否原樣進 32」與調色盤上限，屬精靈安裝問題，不在本份動畫規則研究裡改動（依指示，研究完成前不接新幀）。

---

## 7. 下一步（尚未執行）

在使用者確認「跟原機：官方格＋圖示層」之後，才應該：

1. 下載並對表官方 DMC／PenC／（若取得）DM20 全集，按上表映射到本專案幀鍵；官方彩色不修圖。
2. 做一套共用圖示（食物、Z、骷髏、便便、訓練牆等），主畫面與戰鬥按原機方式叠上去。
3. 沒有官方格的動作才新畫，且必須是真姿勢。
4. 更新 `frame-coverage.md`（標來源與 URL）、`anim-sample.png`、測試、sw 版本與 zip。
