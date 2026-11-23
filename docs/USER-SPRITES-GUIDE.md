# 自訂怪獸圖檔放置說明（v35）

v35 不內附新的怪獸圖檔。它新增了一個「自訂圖檔」功能：你把自己的 PNG 放進 repo 的固定資料夾，並在清單檔裡登記，遊戲就會用你的圖取代內建的 v34 圖；沒有放的影格，照舊用內建圖。

- 適用機種：1997 Digital Monster Ver.1–5（`dm1997`）、超代 Pendulum Ver.1.0（`pendulum`）
- 完整檔名清單（Excel 可開）：`docs/user-sprites-list.csv`（共 1458 個檔名）
- 檢查頁：`user-sprites-check.html`（網址：`https://a307625.github.io/digivice/user-sprites-check.html`）

---

## 1. 資料夾

```
assets/user-sprites/
├── manifest.json        ← 清單：你放了哪些檔，就要寫在這裡
├── expected.json        ← 遊戲認得的所有檔名（自動產生，不用改）
├── dm1997/              ← 1997 Ver.1–5 的圖
│   ├── agumon_idle0.png
│   └── …
└── pendulum/            ← Pendulum 1.0 的圖
    ├── tentomon_idle0.png
    └── …
```

## 2. 檔名規則

`<怪獸ID>_<影格>.png`，全部小寫英文、數字、底線，不能有空格或中文。

- 例：`dm1997/agumon_idle0.png`、`pendulum/egg_pen_1_0_idle1.png`
- 怪獸 ID 本身可以有底線（例如 `egg_pen_1_0`）；最後一個底線後面是影格名稱。
- 每一隻怪獸要用哪些 ID，請看第 6 節或 CSV。

### 影格名稱

1997 怪獸（每隻 15 個）：

| 影格 | 說明 | 遊戲在哪裡用 |
|---|---|---|
| `idle0` | 待機 1（**必要**） | 平常走動、狀態、對戰開場；其他影格缺少時的最後備用 |
| `idle1` | 待機 2 | 和 idle0 每 0.5 秒交替 |
| `eat0` | 吃 1（閉口） | 吃東西動畫 |
| `eat1` | 吃 2（張口） | 吃東西動畫 |
| `happy` | 開心 | 訓練成功、吃完、勝利 |
| `angry` | 生氣 | 訓練失敗、生氣 |
| `refuse` | 拒絕（搖頭） | 吃飽了不吃、拒絕 |
| `sleep0` | 睡覺 1 | 睡覺 |
| `sleep1` | 睡覺 2 | 睡覺（交替） |
| `train0` | 訓練 1 | 訓練畫面 |
| `train1` | 訓練 2 | 訓練畫面（交替） |
| `attack` | 攻擊 | 對戰、訓練出招 |
| `sick` | 生病 | 生病 |
| `hurt` | 受傷／被打 | 對戰被打中 |
| `lose` | 輸／倒下 | 對戰輸、死亡前 |

1997 數碼蛋 `egg_v1`～`egg_v5`（每個 3 個）：`idle0`、`idle1`（搖動）、`hatch`（裂開）。

Pendulum 1.0 怪獸（每隻 12 個）：`idle0`、`idle1`、`eat0`、`eat1`、`happy`、`angry`、`refuse`、`sleep0`、`sleep1`、`attack`、`sick`、`lose`（意思同上表；Pendulum 沒有 train/hurt 影格）。

Pendulum 1.0 數碼蛋 `egg_pen_1_0`：`idle0`、`idle1`。
選用：`pen_computer_idle0.png`（連線畫面的電腦）。

### 缺影格時怎麼辦

只要放了某一隻的 **idle0**，那一隻就整隻改用你的圖：缺的影格會自動用你自己的相近影格代替（例如沒有 `sleep1` 就用 `sleep0`，沒有 `eat0` 就用 `idle0`），不會和內建圖混在一起。所以最少每隻放 `idle0` 就能用，放越多動作越完整。

## 3. 圖檔規格

| 項目 | 要求 |
|---|---|
| 格式 | PNG（`.png`，副檔名小寫） |
| 尺寸 | **16×16 像素**，一個像素 = 液晶上一個點。也接受 32×32（每點 2×2 像素，例如從 2 倍圖存下來的）。|
| 顏色 | 彩色可以，任何顏色照原樣顯示 |
| 背景 | **透明**。透明度 < 50% 的像素當成透明，其他當成實心點（不會有半透明、模糊邊）。|
| 方向 | 怪獸**面向左**（和內建圖相同）；對戰時遊戲會自動左右翻轉 |
| 位置 | 腳踩在圖的最下面一列，左右置中（和內建圖相同的 16×16 格子）|

遊戲會把圖放大成整數倍（16×16 → 每點 4×4 螢幕像素），和液晶上所有文字、圖示同一個點大小；**不會縮小、不會拉伸、不會模糊**。尺寸不對的檔（例如 15×16、48×48、200×200）會被略過，主控台會印出原因，那一格改用同一隻的其他影格或內建圖。

## 4. 清單檔 manifest.json

為了離線也能用，遊戲只載入清單裡有寫的檔。格式：

```json
{
  "files": [
    "dm1997/agumon_idle0.png",
    "dm1997/agumon_idle1.png",
    "pendulum/tentomon_idle0.png"
  ]
}
```

- 路徑從 `assets/user-sprites/` 之後開始寫（`dm1997/…` 或 `pendulum/…`）。
- 每一行用雙引號，行與行之間用逗號，**最後一行後面不要有逗號**。
- 小技巧：打開 `docs/user-sprites-list.csv`，第 3 欄就是要寫進清單的檔名，可以直接複製。

## 5. 用 GitHub 網頁上傳（不用裝任何程式）

1. 打開 repo（`https://github.com/a307625/digivice`），進入 `assets/user-sprites/dm1997`（或 `pendulum`）資料夾。
2. 右上角 **Add file → Upload files**，把 PNG 拖進去（可以一次拖很多個）。
3. 下面 **Commit changes** 填一句說明（例如「加入亞古獸圖」），按 **Commit changes**。
4. 回到 `assets/user-sprites/`，點 `manifest.json` → 右上角鉛筆（Edit）→ 把剛剛上傳的檔名加進 `"files"` → **Commit changes**。
5. 等 1～2 分鐘（GitHub Pages 更新）。

> 資料夾還不存在時：在 Upload files 頁面，可以直接把整個 `dm1997` 資料夾拖進 `assets/user-sprites/`。

## 6. 怎麼確認有成功

1. **檢查頁**：打開 `https://a307625.github.io/digivice/user-sprites-check.html`
   - 上方顯示 manifest 是否讀到、成功載入幾個、錯誤幾個。
   - 每一列：檔名、狀態（已載入 ✓／錯誤 ✗／尺寸不符／檔名不在清單）、原因、以遊戲點大小顯示的預覽。
   - 取消勾選「只顯示 manifest 有列出的檔案」可以看到全部 1458 個可用檔名，哪些還沒放。
2. **遊戲裡**：重新整理遊戲頁（iPhone 主畫面 App：完全關掉再開）。主控台（電腦 Chrome：F12 → Console）會看到 `[user-sprites] loaded dm1997/agumon_idle0.png`；有問題會看到 `[user-sprites] … (built-in sprite used)`。也可以在主控台輸入 `UserSprites.report()` 看清單。
3. **離線**：上線開過一次後，清單裡的圖會存進離線快取；之後沒有網路也會顯示你的圖。新增或替換圖後，連網開一次就會更新。

## 7. 常見問題

- **放了圖但沒變**：manifest.json 有沒有寫？檔名大小寫、底線是否和 CSV 一模一樣？檢查頁會告訴你原因。
- **圖變模糊或大小不對**：一定要 16×16（或 32×32），不要先放大再存。
- **只想換某幾隻**：只放那幾隻即可，其他照舊。
- **想改回內建圖**：把該檔從 manifest.json 刪掉（或刪掉檔案）即可。

## 8. 每個機種的怪獸 ID

完整的「怪獸 × 影格」檔名在 `docs/user-sprites-list.csv`（UTF-8，Excel 可直接開）。

#### 1997 Ver.1（17 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_v1` | 版本一數碼蛋 | Ver.1 Digitama | 數碼蛋 | 3 |
| `botamon` | 黑球獸 | Botamon | 幼年期Ⅰ | 15 |
| `koromon` | 滾球獸 | Koromon | 幼年期Ⅱ | 15 |
| `agumon` | 亞古獸 | Agumon | 成長期 | 15 |
| `betamon` | 比特獸 | Betamon | 成長期 | 15 |
| `greymon` | 暴龍獸 | Greymon | 成熟期 | 15 |
| `tyranomon` | 巨龍獸 | Tyranomon | 成熟期 | 15 |
| `devimon` | 惡魔獸 | Devimon | 成熟期 | 15 |
| `meramon` | 火焰獸 | Meramon | 成熟期 | 15 |
| `airdramon` | 飛龍獸 | Airdramon | 成熟期 | 15 |
| `seadramon` | 海龍獸 | Seadramon | 成熟期 | 15 |
| `numemon` | 鼻涕獸 | Numemon | 成熟期 | 15 |
| `metalgreymon` | 機械暴龍獸 (病毒種) | MetalGreymon (Virus) | 完全體 | 15 |
| `mamemon` | 豆豆獸 | Mamemon | 完全體 | 15 |
| `monzaemon` | 熊仔獸 | Monzaemon | 完全體 | 15 |
| `blitzgreymon` | 電光暴龍獸 | BlitzGreymon | 究極體 | 15 |
| `banchomamemon` | 番長豆豆獸 | BanchoMamemon | 究極體 | 15 |

#### 1997 Ver.2（17 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_v2` | 版本二數碼蛋 | Ver.2 Digitama | 數碼蛋 | 3 |
| `punimon` | 普尼獸 | Punimon | 幼年期Ⅰ | 15 |
| `tsunomon` | 獨角獸 | Tsunomon | 幼年期Ⅱ | 15 |
| `gabumon` | 加布獸 | Gabumon | 成長期 | 15 |
| `elecmon` | 艾力獸 | Elecmon | 成長期 | 15 |
| `kabuterimon` | 比多獸 | Kabuterimon | 成熟期 | 15 |
| `garurumon` | 加魯魯獸 | Garurumon | 成熟期 | 15 |
| `angemon` | 天使獸 | Angemon | 成熟期 | 15 |
| `yukidarumon` | 雪人獸 | Yukidarumon | 成熟期 | 15 |
| `birdramon` | 巴多拉獸 | Birdramon | 成熟期 | 15 |
| `whamon` | 巨鯨獸 | Whamon | 成熟期 | 15 |
| `vegimon` | 鼻屎獸 | Vegimon | 成熟期 | 15 |
| `skullgreymon` | 喪屍暴龍獸 | SkullGreymon | 完全體 | 15 |
| `metalmamemon` | 鋼鐵豆豆獸 | MetalMamemon | 完全體 | 15 |
| `vademon` | 入侵者獸 | Vademon | 完全體 | 15 |
| `skullmammon` | 喪屍長毛象獸 | SkullMammon | 究極體 | 15 |
| `cresgarurumon` | 偃月加魯魯獸 | CresGarurumon | 究極體 | 15 |

#### 1997 Ver.3（17 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_v3` | 版本三數碼蛋 | Ver.3 Digitama | 數碼蛋 | 3 |
| `poyomon` | 浮游獸 | Poyomon | 幼年期Ⅰ | 15 |
| `tokomon` | 迪哥獸 | Tokomon | 幼年期Ⅱ | 15 |
| `patamon` | 巴達獸 | Patamon | 成長期 | 15 |
| `kunemon` | 古尼獸 | Kunemon | 成長期 | 15 |
| `unimon` | 獨角馬獸 | Unimon | 成熟期 | 15 |
| `centalmon` | 人馬獸 | Centalmon | 成熟期 | 15 |
| `ogremon` | 奧加獸 | Ogremon | 成熟期 | 15 |
| `bakemon` | 猛鬼獸 | Bakemon | 成熟期 | 15 |
| `shellmon` | 貝殼獸 | Shellmon | 成熟期 | 15 |
| `drimogemon` | 鑽地獸 | Drimogemon | 成熟期 | 15 |
| `sukamon` | 大便獸 | Sukamon | 成熟期 | 15 |
| `andromon` | 安杜路獸 | Andromon | 完全體 | 15 |
| `giromon` | 砲彈獸 | Giromon | 完全體 | 15 |
| `etemon` | 悟空獸 | Etemon | 完全體 | 15 |
| `hiandromon` | 高級安杜路獸 | HiAndromon | 究極體 | 15 |
| `kingetemon` | 大王悟空獸 | KingEtemon | 究極體 | 15 |

#### 1997 Ver.4（17 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_v4` | 版本四數碼蛋 | Ver.4 Digitama | 數碼蛋 | 3 |
| `yuramon` | 浮球獸 | Yuramon | 幼年期Ⅰ | 15 |
| `tanemon` | 種子獸 | Tanemon | 幼年期Ⅱ | 15 |
| `piyomon` | 比丘獸 | Piyomon | 成長期 | 15 |
| `palmon` | 巴魯獸 | Palmon | 成長期 | 15 |
| `monochromon` | 角龍獸 | Monochromon | 成熟期 | 15 |
| `cockatrimon` | 巨雞獸 | Cockatrimon | 成熟期 | 15 |
| `leomon` | 獅子獸 | Leomon | 成熟期 | 15 |
| `kuwagamon` | 古加獸 | Kuwagamon | 成熟期 | 15 |
| `coelamon` | 西拉獸 | Coelamon | 成熟期 | 15 |
| `mojyamon` | 毛人獸 | Mojyamon | 成熟期 | 15 |
| `nanimon` | 亞伯獸 | Nanimon | 成熟期 | 15 |
| `megadramon` | 超蛇龍獸 | Megadramon | 完全體 | 15 |
| `piccolomon` | 妖精獸 | Piccolomon | 完全體 | 15 |
| `digitamamon` | 蛋蛋獸 | Digitamamon | 完全體 | 15 |
| `aegisdramon` | 聖盾龍獸 | Aegisdramon | 究極體 | 15 |
| `titamon` | 泰坦獸 | Titamon | 究極體 | 15 |

#### 1997 Ver.5（17 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_v5` | 版本五數碼蛋 | Ver.5 Digitama | 數碼蛋 | 3 |
| `zurumon` | 狡猾獸 | Zurumon | 幼年期Ⅰ | 15 |
| `pagumon` | 柏古獸 | Pagumon | 幼年期Ⅱ | 15 |
| `gazimon` | 加支獸 | Gazimon | 成長期 | 15 |
| `gizamon` | 基剎獸 | Gizamon | 成長期 | 15 |
| `darktyranomon` | 黑暗巨龍獸 | DarkTyranomon | 成熟期 | 15 |
| `cyclomon` | 獨眼龍獸 | Cyclomon | 成熟期 | 15 |
| `devidramon` | 邪龍獸 | Devidramon | 成熟期 | 15 |
| `tuskmon` | 大角獸 | Tuskmon | 成熟期 | 15 |
| `flymon` | 黃蜂獸 | Flymon | 成熟期 | 15 |
| `deltamon` | 三頭龍獸 | Deltamon | 成熟期 | 15 |
| `raremon` | 爛泥獸 | Raremon | 成熟期 | 15 |
| `metaltyranomon` | 鋼鐵巨龍獸 | MetalTyranomon | 完全體 | 15 |
| `nanomon` | 分子獸 | Nanomon | 完全體 | 15 |
| `extyranomon` | 巨龍獸EX | ExTyranomon | 完全體 | 15 |
| `mugendramon` | 機械邪龍獸 | Mugendramon | 究極體 | 15 |
| `pinochimon` | 木偶獸 | Pinochimon | 究極體 | 15 |

#### Pendulum 1.0（22 隻／243 個檔）

| 怪獸 ID（檔名開頭） | 中文名 | 英文名 | 階段 | 檔數 |
|---|---|---|---|---|
| `egg_pen_1_0` | 超代 1.0 數碼蛋 | Pendulum 1.0 Digitama | 數碼蛋 | 2 |
| `babumon` | 巴布獸 | Babumon / Bubbmon | 幼年期Ⅰ | 12 |
| `motimon` | 種子獸 | Motimon | 幼年期Ⅱ | 12 |
| `tentomon` | 甲蟲獸 | Tentomon | 成長期 | 12 |
| `gotsumon` | 岩石獸 | Gotsumon | 成長期 | 12 |
| `otamamon` | 蝌蚪獸 | Otamamon | 成長期 | 12 |
| `kabuterimon` | 比多獸 | Kabuterimon | 成熟期 | 12 |
| `tortomon` | 頓甲獸 | Tortomon | 成熟期 | 12 |
| `kuwagamon` | 古加獸 | Kuwagamon | 成熟期 | 12 |
| `gekomon` | 加哥怪獸 | Gekomon | 成熟期 | 12 |
| `monochromon` | 單角龍獸 | Monochromon | 成熟期 | 12 |
| `starmon` | 星獸 | Starmon | 成熟期 | 12 |
| `atlurkabuterimon` | 超比多獸 | AtlurKabuterimon | 完全體 | 12 |
| `triceramon` | 三角龍獸 | Triceramon | 完全體 | 12 |
| `okuwamon` | 大古加獸 | Okuwamon | 完全體 | 12 |
| `jagamon` | 炸薯獸 | Jagamon | 完全體 | 12 |
| `piccolomon` | 比丘獸 | Piccolomon | 完全體 | 12 |
| `tonosamagekomon` | 王者加哥怪獸 | TonosamaGekomon | 完全體 | 12 |
| `heracleskabuterimon` | 大力神甲蟲獸 | HeraclesKabuterimon | 完全體 | 12 |
| `saberleomon` | 刃獅獸 | SaberLeomon | 完全體 | 12 |
| `metaletemon` | 金屬艾力獸 | MetalEtemon | 完全體 | 12 |
| `pen_computer` | 對戰電腦（連線畫面） | Computer |  | 1 |

---
本功能程式：`js/user-sprites.js`（載入、尺寸檢查、備用影格）、`sw.js`（離線快取）、`user-sprites-check.html`（檢查頁）、`scripts/user-sprite-list.js`（產生 CSV 與 expected.json）。
