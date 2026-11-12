/**
 * Official Digital Monster Ver.1–5 evolution data + 20th Anniversary Mega.
 * Condition table is data-driven: first matching rule wins; leftover/stay last.
 * Source of truth for the game, tests, and evolution-chart.md.
 */
(function (root) {
  'use strict';
  var STAGES = { egg: { id: "egg", zh: "數碼蛋", en: "Egg" }, baby1: { id: "baby1", zh: "幼年期Ⅰ", en: "Baby I" }, baby2: { id: "baby2", zh: "幼年期Ⅱ", en: "Baby II" }, rookie: { id: "rookie", zh: "成長期", en: "Rookie" }, champion: { id: "champion", zh: "成熟期", en: "Champion" }, ultimate: { id: "ultimate", zh: "完全體", en: "Ultimate" }, mega: { id: "mega", zh: "究極體", en: "Mega" }, super: { id: "super", zh: "超究極體", en: "Super Ultimate" } };
  var VERSIONS = { "1": { zh: "Ver.1", en: "Digital Monster Ver.1 (1997)", baby1: "botamon", theme: "#c45c20" }, "2": { zh: "Ver.2", en: "Digital Monster Ver.2 (1997)", baby1: "punimon", theme: "#3a6fb0" }, "3": { zh: "Ver.3", en: "Digital Monster Ver.3 (1998)", baby1: "poyomon", theme: "#7b4cb0" }, "4": { zh: "Ver.4", en: "Digital Monster Ver.4 (1998)", baby1: "yuramon", theme: "#2f8a4a" }, "5": { zh: "Ver.5", en: "Digital Monster Ver.5 (1998)", baby1: "zurumon", theme: "#5a5a5a" } };
  var MONSTERS = {
    egg_v1: { id: "egg_v1", version: 1, stage: "egg", nameZh: "版本一數碼蛋", nameEn: "Ver.1 Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "any", rank: null, tribe: null, egg: "ver1", hatch: "botamon" },
    egg_v2: { id: "egg_v2", version: 2, stage: "egg", nameZh: "版本二數碼蛋", nameEn: "Ver.2 Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver2", hatch: "punimon" },
    egg_v3: { id: "egg_v3", version: 3, stage: "egg", nameZh: "版本三數碼蛋", nameEn: "Ver.3 Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver3", hatch: "poyomon" },
    egg_v4: { id: "egg_v4", version: 4, stage: "egg", nameZh: "版本四數碼蛋", nameEn: "Ver.4 Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver4", hatch: "yuramon" },
    egg_v5: { id: "egg_v5", version: 5, stage: "egg", nameZh: "版本五數碼蛋", nameEn: "Ver.5 Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver5", hatch: "zurumon" },
    botamon: { id: "botamon", version: 1, stage: "baby1", nameZh: "黑球獸", nameEn: "Botamon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "any", rank: null, tribe: null, egg: "ver1" },
    koromon: { id: "koromon", version: 1, stage: "baby2", nameZh: "滾球獸", nameEn: "Koromon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "any", rank: null, tribe: null, egg: "ver1" },
    agumon: { id: "agumon", version: 1, stage: "rookie", nameZh: "亞古獸", nameEn: "Agumon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "any", rank: "S", tribe: "A", egg: "ver1" },
    betamon: { id: "betamon", version: 1, stage: "rookie", nameZh: "比特獸", nameEn: "Betamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "any", rank: "A", tribe: "C", egg: "ver1" },
    greymon: { id: "greymon", version: 1, stage: "champion", nameZh: "暴龍獸", nameEn: "Greymon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "any", rank: "S", tribe: "A", egg: "ver1" },
    tyranomon: { id: "tyranomon", version: 1, stage: "champion", nameZh: "巨龍獸", nameEn: "Tyranomon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "any", rank: "A", tribe: "A", egg: "ver1" },
    devimon: { id: "devimon", version: 1, stage: "champion", nameZh: "惡魔獸", nameEn: "Devimon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "any", rank: "S", tribe: "B", egg: "ver1" },
    meramon: { id: "meramon", version: 1, stage: "champion", nameZh: "火焰獸", nameEn: "Meramon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "any", rank: "A", tribe: "B", egg: "ver1" },
    airdramon: { id: "airdramon", version: 1, stage: "champion", nameZh: "飛龍獸", nameEn: "Airdramon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "any", rank: "S", tribe: "C", egg: "ver1" },
    seadramon: { id: "seadramon", version: 1, stage: "champion", nameZh: "海龍獸", nameEn: "Seadramon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "any", rank: "A", tribe: "C", egg: "ver1" },
    numemon: { id: "numemon", version: 1, stage: "champion", nameZh: "鼻涕獸", nameEn: "Numemon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "any", rank: "B", tribe: null, egg: "ver1" },
    metalgreymon: { id: "metalgreymon", version: 1, stage: "ultimate", nameZh: "機械暴龍獸 (病毒種)", nameEn: "MetalGreymon (Virus)", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "any", rank: "S", tribe: "A", egg: "ver1" },
    mamemon: { id: "mamemon", version: 1, stage: "ultimate", nameZh: "豆豆獸", nameEn: "Mamemon", lifespanMin: 2880, weight: 20, canBattle: true, trainCounts: "any", rank: "A", tribe: "A", egg: "ver1" },
    monzaemon: { id: "monzaemon", version: 1, stage: "ultimate", nameZh: "熊仔獸", nameEn: "Monzaemon", lifespanMin: 2880, weight: 35, canBattle: true, trainCounts: "any", rank: "S", tribe: null, egg: "ver1", noMega: true },
    blitzgreymon: { id: "blitzgreymon", version: 1, stage: "mega", nameZh: "電光暴龍獸", nameEn: "BlitzGreymon", lifespanMin: 5760, weight: 45, canBattle: true, trainCounts: "any", rank: "M", tribe: "A", egg: "ver1" },
    banchomamemon: { id: "banchomamemon", version: 1, stage: "mega", nameZh: "番長豆豆獸", nameEn: "BanchoMamemon", lifespanMin: 5760, weight: 22, canBattle: true, trainCounts: "any", rank: "M", tribe: "A", egg: "ver1" },
    punimon: { id: "punimon", version: 2, stage: "baby1", nameZh: "普尼獸", nameEn: "Punimon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver2" },
    tsunomon: { id: "tsunomon", version: 2, stage: "baby2", nameZh: "獨角獸", nameEn: "Tsunomon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver2" },
    gabumon: { id: "gabumon", version: 2, stage: "rookie", nameZh: "加布獸", nameEn: "Gabumon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver2" },
    elecmon: { id: "elecmon", version: 2, stage: "rookie", nameZh: "艾力獸", nameEn: "Elecmon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver2" },
    kabuterimon: { id: "kabuterimon", version: 2, stage: "champion", nameZh: "比多獸", nameEn: "Kabuterimon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver2" },
    garurumon: { id: "garurumon", version: 2, stage: "champion", nameZh: "加魯魯獸", nameEn: "Garurumon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver2" },
    angemon: { id: "angemon", version: 2, stage: "champion", nameZh: "天使獸", nameEn: "Angemon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "S", tribe: "B", egg: "ver2" },
    yukidarumon: { id: "yukidarumon", version: 2, stage: "champion", nameZh: "雪人獸", nameEn: "Yukidarumon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "A", tribe: "B", egg: "ver2" },
    birdramon: { id: "birdramon", version: 2, stage: "champion", nameZh: "巴多拉獸", nameEn: "Birdramon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "S", tribe: "C", egg: "ver2" },
    whamon: { id: "whamon", version: 2, stage: "champion", nameZh: "巨鯨獸", nameEn: "Whamon", lifespanMin: 4320, weight: 40, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver2" },
    vegimon: { id: "vegimon", version: 2, stage: "champion", nameZh: "鼻屎獸", nameEn: "Vegimon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "B", tribe: null, egg: "ver2" },
    skullgreymon: { id: "skullgreymon", version: 2, stage: "ultimate", nameZh: "喪屍暴龍獸", nameEn: "SkullGreymon", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver2" },
    metalmamemon: { id: "metalmamemon", version: 2, stage: "ultimate", nameZh: "鋼鐵豆豆獸", nameEn: "MetalMamemon", lifespanMin: 2880, weight: 20, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver2" },
    vademon: { id: "vademon", version: 2, stage: "ultimate", nameZh: "入侵者獸", nameEn: "Vademon", lifespanMin: 2880, weight: 25, canBattle: true, trainCounts: "success", rank: "S", tribe: null, egg: "ver2", noMega: true },
    skullmammon: { id: "skullmammon", version: 2, stage: "mega", nameZh: "喪屍長毛象獸", nameEn: "SkullMammon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "ver2" },
    cresgarurumon: { id: "cresgarurumon", version: 2, stage: "mega", nameZh: "偃月加魯魯獸", nameEn: "CresGarurumon", lifespanMin: 5760, weight: 40, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "ver2" },
    poyomon: { id: "poyomon", version: 3, stage: "baby1", nameZh: "浮游獸", nameEn: "Poyomon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver3" },
    tokomon: { id: "tokomon", version: 3, stage: "baby2", nameZh: "迪哥獸", nameEn: "Tokomon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver3" },
    patamon: { id: "patamon", version: 3, stage: "rookie", nameZh: "巴達獸", nameEn: "Patamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver3" },
    kunemon: { id: "kunemon", version: 3, stage: "rookie", nameZh: "古尼獸", nameEn: "Kunemon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver3" },
    unimon: { id: "unimon", version: 3, stage: "champion", nameZh: "獨角馬獸", nameEn: "Unimon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver3" },
    centalmon: { id: "centalmon", version: 3, stage: "champion", nameZh: "人馬獸", nameEn: "Centalmon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver3" },
    ogremon: { id: "ogremon", version: 3, stage: "champion", nameZh: "奧加獸", nameEn: "Ogremon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "B", egg: "ver3" },
    bakemon: { id: "bakemon", version: 3, stage: "champion", nameZh: "猛鬼獸", nameEn: "Bakemon", lifespanMin: 4320, weight: 22, canBattle: true, trainCounts: "success", rank: "A", tribe: "B", egg: "ver3" },
    shellmon: { id: "shellmon", version: 3, stage: "champion", nameZh: "貝殼獸", nameEn: "Shellmon", lifespanMin: 4320, weight: 32, canBattle: true, trainCounts: "success", rank: "S", tribe: "C", egg: "ver3" },
    drimogemon: { id: "drimogemon", version: 3, stage: "champion", nameZh: "鑽地獸", nameEn: "Drimogemon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver3" },
    sukamon: { id: "sukamon", version: 3, stage: "champion", nameZh: "大便獸", nameEn: "Sukamon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "B", tribe: null, egg: "ver3" },
    andromon: { id: "andromon", version: 3, stage: "ultimate", nameZh: "安杜路獸", nameEn: "Andromon", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver3" },
    giromon: { id: "giromon", version: 3, stage: "ultimate", nameZh: "砲彈獸", nameEn: "Giromon", lifespanMin: 2880, weight: 25, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver3", noMega: true },
    etemon: { id: "etemon", version: 3, stage: "ultimate", nameZh: "悟空獸", nameEn: "Etemon", lifespanMin: 2880, weight: 28, canBattle: true, trainCounts: "success", rank: "S", tribe: null, egg: "ver3" },
    hiandromon: { id: "hiandromon", version: 3, stage: "mega", nameZh: "高級安杜路獸", nameEn: "HiAndromon", lifespanMin: 5760, weight: 45, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "ver3" },
    kingetemon: { id: "kingetemon", version: 3, stage: "mega", nameZh: "大王悟空獸", nameEn: "KingEtemon", lifespanMin: 5760, weight: 30, canBattle: true, trainCounts: "success", rank: "M", tribe: null, egg: "ver3" },
    yuramon: { id: "yuramon", version: 4, stage: "baby1", nameZh: "浮球獸", nameEn: "Yuramon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver4" },
    tanemon: { id: "tanemon", version: 4, stage: "baby2", nameZh: "種子獸", nameEn: "Tanemon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver4" },
    piyomon: { id: "piyomon", version: 4, stage: "rookie", nameZh: "比丘獸", nameEn: "Piyomon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver4" },
    palmon: { id: "palmon", version: 4, stage: "rookie", nameZh: "巴魯獸", nameEn: "Palmon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver4" },
    monochromon: { id: "monochromon", version: 4, stage: "champion", nameZh: "角龍獸", nameEn: "Monochromon", lifespanMin: 4320, weight: 35, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver4" },
    cockatrimon: { id: "cockatrimon", version: 4, stage: "champion", nameZh: "巨雞獸", nameEn: "Cockatrimon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver4" },
    leomon: { id: "leomon", version: 4, stage: "champion", nameZh: "獅子獸", nameEn: "Leomon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "S", tribe: "B", egg: "ver4" },
    kuwagamon: { id: "kuwagamon", version: 4, stage: "champion", nameZh: "古加獸", nameEn: "Kuwagamon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "B", egg: "ver4" },
    coelamon: { id: "coelamon", version: 4, stage: "champion", nameZh: "西拉獸", nameEn: "Coelamon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "C", egg: "ver4" },
    mojyamon: { id: "mojyamon", version: 4, stage: "champion", nameZh: "毛人獸", nameEn: "Mojyamon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver4" },
    nanimon: { id: "nanimon", version: 4, stage: "champion", nameZh: "亞伯獸", nameEn: "Nanimon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "B", tribe: null, egg: "ver4" },
    megadramon: { id: "megadramon", version: 4, stage: "ultimate", nameZh: "超蛇龍獸", nameEn: "Megadramon", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver4" },
    piccolomon: { id: "piccolomon", version: 4, stage: "ultimate", nameZh: "妖精獸", nameEn: "Piccolomon", lifespanMin: 2880, weight: 10, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver4", noMega: true },
    digitamamon: { id: "digitamamon", version: 4, stage: "ultimate", nameZh: "蛋蛋獸", nameEn: "Digitamamon", lifespanMin: 2880, weight: 22, canBattle: true, trainCounts: "success", rank: "S", tribe: null, egg: "ver4" },
    aegisdramon: { id: "aegisdramon", version: 4, stage: "mega", nameZh: "聖盾龍獸", nameEn: "Aegisdramon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "ver4" },
    titamon: { id: "titamon", version: 4, stage: "mega", nameZh: "泰坦獸", nameEn: "Titamon", lifespanMin: 5760, weight: 45, canBattle: true, trainCounts: "success", rank: "M", tribe: null, egg: "ver4" },
    zurumon: { id: "zurumon", version: 5, stage: "baby1", nameZh: "狡猾獸", nameEn: "Zurumon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver5" },
    pagumon: { id: "pagumon", version: 5, stage: "baby2", nameZh: "柏古獸", nameEn: "Pagumon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "ver5" },
    gazimon: { id: "gazimon", version: 5, stage: "rookie", nameZh: "加支獸", nameEn: "Gazimon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver5" },
    gizamon: { id: "gizamon", version: 5, stage: "rookie", nameZh: "基剎獸", nameEn: "Gizamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver5" },
    darktyranomon: { id: "darktyranomon", version: 5, stage: "champion", nameZh: "黑暗巨龍獸", nameEn: "DarkTyranomon", lifespanMin: 4320, weight: 32, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver5" },
    cyclomon: { id: "cyclomon", version: 5, stage: "champion", nameZh: "獨眼龍獸", nameEn: "Cyclomon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver5" },
    devidramon: { id: "devidramon", version: 5, stage: "champion", nameZh: "邪龍獸", nameEn: "Devidramon", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "B", egg: "ver5" },
    tuskmon: { id: "tuskmon", version: 5, stage: "champion", nameZh: "大角獸", nameEn: "Tuskmon", lifespanMin: 4320, weight: 32, canBattle: true, trainCounts: "success", rank: "A", tribe: "B", egg: "ver5" },
    flymon: { id: "flymon", version: 5, stage: "champion", nameZh: "黃蜂獸", nameEn: "Flymon", lifespanMin: 4320, weight: 25, canBattle: true, trainCounts: "success", rank: "S", tribe: "C", egg: "ver5" },
    deltamon: { id: "deltamon", version: 5, stage: "champion", nameZh: "三頭龍獸", nameEn: "Deltamon", lifespanMin: 4320, weight: 32, canBattle: true, trainCounts: "success", rank: "A", tribe: "C", egg: "ver5" },
    raremon: { id: "raremon", version: 5, stage: "champion", nameZh: "爛泥獸", nameEn: "Raremon", lifespanMin: 4320, weight: 22, canBattle: true, trainCounts: "success", rank: "B", tribe: null, egg: "ver5" },
    metaltyranomon: { id: "metaltyranomon", version: 5, stage: "ultimate", nameZh: "鋼鐵巨龍獸", nameEn: "MetalTyranomon", lifespanMin: 2880, weight: 42, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "ver5" },
    nanomon: { id: "nanomon", version: 5, stage: "ultimate", nameZh: "分子獸", nameEn: "Nanomon", lifespanMin: 2880, weight: 20, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "ver5", noMega: true },
    extyranomon: { id: "extyranomon", version: 5, stage: "ultimate", nameZh: "巨龍獸EX", nameEn: "ExTyranomon", lifespanMin: 2880, weight: 35, canBattle: true, trainCounts: "success", rank: "S", tribe: null, egg: "ver5" },
    mugendramon: { id: "mugendramon", version: 5, stage: "mega", nameZh: "機械邪龍獸", nameEn: "Mugendramon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "ver5" },
    pinochimon: { id: "pinochimon", version: 5, stage: "mega", nameZh: "木偶獸", nameEn: "Pinochimon", lifespanMin: 5760, weight: 22, canBattle: true, trainCounts: "success", rank: "M", tribe: null, egg: "ver5" },
    omegamon_alters: { id: "omegamon_alters", version: 0, stage: "super", nameZh: "奧米加獸 Alter-S", nameEn: "Omegamon Alter-S", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "X", tribe: null, egg: "jogress" },
    lasttyranomon: { id: "lasttyranomon", version: 0, stage: "super", nameZh: "終極巨龍獸", nameEn: "LastTyranomon", lifespanMin: 5760, weight: 52, canBattle: true, trainCounts: "success", rank: "X", tribe: null, egg: "jogress" },
    metalgreymon_va: { id: "metalgreymon_va", version: "special", stage: "ultimate", nameZh: "機械暴龍獸 (疫苗種)", nameEn: "MetalGreymon (Vaccine)", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "anime_agumon" },
    weregarurumon: { id: "weregarurumon", version: "special", stage: "ultimate", nameZh: "獸人加魯魯獸", nameEn: "WereGarurumon", lifespanMin: 2880, weight: 35, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "anime_gabumon" },
    wargreymon: { id: "wargreymon", version: "special", stage: "mega", nameZh: "戰鬥暴龍獸", nameEn: "WarGreymon", lifespanMin: 5760, weight: 42, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "anime_agumon" },
    metalgarurumon: { id: "metalgarurumon", version: "special", stage: "mega", nameZh: "鋼鐵加魯魯獸", nameEn: "MetalGarurumon", lifespanMin: 5760, weight: 42, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "anime_gabumon" },
    omegamon: { id: "omegamon", version: 0, stage: "super", nameZh: "奧米加獸", nameEn: "Omegamon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "X", tribe: null, egg: "jogress" },
    egg_zuba: { id: "egg_zuba", version: "special", stage: "egg", nameZh: "茲巴數碼蛋", nameEn: "Zuba Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "zuba", hatch: "sakumon" },
    egg_hack: { id: "egg_hack", version: "special", stage: "egg", nameZh: "哈克數碼蛋", nameEn: "Hack Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "hack", hatch: "sakumon" },
    egg_dra_blue: { id: "egg_dra_blue", version: "special", stage: "egg", nameZh: "龍仔獸藍蛋（斬龍）", nameEn: "Slayerdra Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "dra_blue", hatch: "petitmon" },
    egg_dra_green: { id: "egg_dra_green", version: "special", stage: "egg", nameZh: "龍仔獸綠蛋（破壞龍）", nameEn: "Breakdra Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "dra_green", hatch: "petitmon" },
    egg_doru: { id: "egg_doru", version: "special", stage: "egg", nameZh: "多路數碼蛋", nameEn: "Doru Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "doru", hatch: "dodomon" },
    egg_anime_agumon: { id: "egg_anime_agumon", version: "special", stage: "egg", nameZh: "動畫亞古獸數碼蛋", nameEn: "Anime Agumon Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "anime_agumon", hatch: "botamon" },
    egg_anime_gabumon: { id: "egg_anime_gabumon", version: "special", stage: "egg", nameZh: "動畫加布獸數碼蛋", nameEn: "Anime Gabumon Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "anime_gabumon", hatch: "punimon" },
    egg_corona: { id: "egg_corona", version: "special", stage: "egg", nameZh: "日冕數碼蛋", nameEn: "Corona Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "corona", hatch: "pichimon" },
    egg_luna: { id: "egg_luna", version: "special", stage: "egg", nameZh: "露娜數碼蛋", nameEn: "Luna Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "luna", hatch: "pichimon" },
    egg_meicoo: { id: "egg_meicoo", version: "special", stage: "egg", nameZh: "梅可可數碼蛋", nameEn: "Meicoo Digitama", lifespanMin: 10, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "meicoo", hatch: "yukimibotamon" },
    sakumon: { id: "sakumon", version: "special", stage: "baby1", nameZh: "薩庫獸", nameEn: "Sakumon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "zuba", nameUnverified: true },
    sakuttomon: { id: "sakuttomon", version: "special", stage: "baby2", nameZh: "薩庫托獸", nameEn: "Sakuttomon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "zuba", nameUnverified: true },
    zubamon: { id: "zubamon", version: "special", stage: "rookie", nameZh: "茲巴獸", nameEn: "Zubamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "zuba" },
    zubaeagermon: { id: "zubaeagermon", version: "special", stage: "champion", nameZh: "茲巴伊戈獸", nameEn: "ZubaEagermon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "zuba" },
    duramon: { id: "duramon", version: "special", stage: "ultimate", nameZh: "杜蘭獸", nameEn: "Duramon", lifespanMin: 2880, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "zuba" },
    durandamon: { id: "durandamon", version: "special", stage: "mega", nameZh: "杜蘭達獸", nameEn: "Durandamon", lifespanMin: 5760, weight: 40, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "zuba" },
    hackmon: { id: "hackmon", version: "special", stage: "rookie", nameZh: "哈克獸", nameEn: "Hackmon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "hack" },
    baohackmon: { id: "baohackmon", version: "special", stage: "champion", nameZh: "刃王哈克獸", nameEn: "BaoHuckmon", lifespanMin: 4320, weight: 22, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "hack" },
    saviorhackmon: { id: "saviorhackmon", version: "special", stage: "ultimate", nameZh: "救星哈克獸", nameEn: "SaviorHuckmon", lifespanMin: 2880, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "hack" },
    jesmon: { id: "jesmon", version: "special", stage: "mega", nameZh: "傑斯獸", nameEn: "Jesmon", lifespanMin: 5760, weight: 35, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "hack" },
    petitmon: { id: "petitmon", version: "special", stage: "baby1", nameZh: "小龍獸", nameEn: "Petitmon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "dra_blue", nameUnverified: true },
    babydmon: { id: "babydmon", version: "special", stage: "baby2", nameZh: "幼龍獸", nameEn: "Babydmon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "dra_blue", nameUnverified: true },
    dracomon: { id: "dracomon", version: "special", stage: "rookie", nameZh: "龍仔獸", nameEn: "Dracomon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "dra_blue" },
    coredramon_blue: { id: "coredramon_blue", version: "special", stage: "champion", nameZh: "核龍獸 (藍)", nameEn: "Coredramon (Blue)", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "dra_blue" },
    wingdramon: { id: "wingdramon", version: "special", stage: "ultimate", nameZh: "翔龍獸", nameEn: "Wingdramon", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "dra_blue" },
    slayerdramon: { id: "slayerdramon", version: "special", stage: "mega", nameZh: "斬龍獸", nameEn: "Slayerdramon", lifespanMin: 5760, weight: 45, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "dra_blue" },
    coredramon_green: { id: "coredramon_green", version: "special", stage: "champion", nameZh: "核龍獸 (綠)", nameEn: "Coredramon (Green)", lifespanMin: 4320, weight: 30, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "dra_green" },
    groundramon: { id: "groundramon", version: "special", stage: "ultimate", nameZh: "地龍獸", nameEn: "Groundramon", lifespanMin: 2880, weight: 45, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "dra_green" },
    breakdramon: { id: "breakdramon", version: "special", stage: "mega", nameZh: "破壞龍獸", nameEn: "Breakdramon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "dra_green" },
    examon: { id: "examon", version: "special", stage: "super", nameZh: "艾克薩獸", nameEn: "Examon", lifespanMin: 5760, weight: 55, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: null },
    dodomon: { id: "dodomon", version: "special", stage: "baby1", nameZh: "多多獸", nameEn: "Dodomon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "doru", nameUnverified: true },
    dorimon: { id: "dorimon", version: "special", stage: "baby2", nameZh: "多利獸", nameEn: "Dorimon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "doru", nameUnverified: true },
    dorumon: { id: "dorumon", version: "special", stage: "rookie", nameZh: "多路獸", nameEn: "DORUmon", lifespanMin: 4320, weight: 18, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "doru" },
    dorugamon: { id: "dorugamon", version: "special", stage: "champion", nameZh: "多路加獸", nameEn: "DORUgamon", lifespanMin: 4320, weight: 28, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "doru" },
    doruguremon: { id: "doruguremon", version: "special", stage: "ultimate", nameZh: "多路龍獸", nameEn: "DORUguremon", lifespanMin: 2880, weight: 40, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "doru" },
    alphamon: { id: "alphamon", version: "special", stage: "mega", nameZh: "阿爾法獸", nameEn: "Alphamon", lifespanMin: 5760, weight: 42, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "doru" },
    pichimon: { id: "pichimon", version: "special", stage: "baby1", nameZh: "比基獸", nameEn: "Pichimon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "corona" },
    pukamon: { id: "pukamon", version: "special", stage: "baby2", nameZh: "布加獸", nameEn: "Pukamon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "corona" },
    coronamon: { id: "coronamon", version: "special", stage: "rookie", nameZh: "日冕獸", nameEn: "Coronamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "corona" },
    firamon: { id: "firamon", version: "special", stage: "champion", nameZh: "焰獅獸", nameEn: "Firamon", lifespanMin: 4320, weight: 25, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "corona" },
    flaremon: { id: "flaremon", version: "special", stage: "ultimate", nameZh: "耀獅獸", nameEn: "Flaremon", lifespanMin: 2880, weight: 35, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "corona" },
    apollomon: { id: "apollomon", version: "special", stage: "mega", nameZh: "阿波羅獸", nameEn: "Apollomon", lifespanMin: 5760, weight: 40, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "corona" },
    lunamon: { id: "lunamon", version: "special", stage: "rookie", nameZh: "露娜獸", nameEn: "Lunamon", lifespanMin: 4320, weight: 15, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "luna" },
    lekismon: { id: "lekismon", version: "special", stage: "champion", nameZh: "雷克斯獸", nameEn: "Lekismon", lifespanMin: 4320, weight: 22, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "luna" },
    crescemon: { id: "crescemon", version: "special", stage: "ultimate", nameZh: "新月獸", nameEn: "Crescemon", lifespanMin: 2880, weight: 30, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "luna" },
    dianamon: { id: "dianamon", version: "special", stage: "mega", nameZh: "狄安娜獸", nameEn: "Dianamon", lifespanMin: 5760, weight: 35, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "luna" },
    gracenovamon: { id: "gracenovamon", version: "special", stage: "super", nameZh: "優雅新星獸", nameEn: "GraceNovamon", lifespanMin: 5760, weight: 50, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: null },
    yukimibotamon: { id: "yukimibotamon", version: "special", stage: "baby1", nameZh: "雪球獸", nameEn: "Yukimibotamon", lifespanMin: 60, weight: 5, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "meicoo" },
    nyaromon: { id: "nyaromon", version: "special", stage: "baby2", nameZh: "貓貓獸", nameEn: "Nyaromon", lifespanMin: 1440, weight: 10, canBattle: false, trainCounts: "success", rank: null, tribe: null, egg: "meicoo" },
    plotmon: { id: "plotmon", version: "special", stage: "rookie", nameZh: "小狗獸", nameEn: "Plotmon", lifespanMin: 4320, weight: 12, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "meicoo" },
    meicoomon: { id: "meicoomon", version: "special", stage: "champion", nameZh: "緬因貓獸", nameEn: "Meicoomon", lifespanMin: 4320, weight: 20, canBattle: true, trainCounts: "success", rank: "A", tribe: "A", egg: "meicoo" },
    meicrackmon: { id: "meicrackmon", version: "special", stage: "ultimate", nameZh: "緬破獸", nameEn: "Meicrackmon", lifespanMin: 2880, weight: 28, canBattle: true, trainCounts: "success", rank: "S", tribe: "A", egg: "meicoo" },
    rasielmon: { id: "rasielmon", version: "special", stage: "mega", nameZh: "拉結爾獸", nameEn: "Rasielmon", lifespanMin: 5760, weight: 35, canBattle: true, trainCounts: "success", rank: "M", tribe: "A", egg: "meicoo" },
  };
  var BRANCHES = {
    egg_v1: [
      { to: "botamon", leftover: false, stay: false },
    ],
    egg_v2: [
      { to: "punimon", leftover: false, stay: false },
    ],
    egg_v3: [
      { to: "poyomon", leftover: false, stay: false },
    ],
    egg_v4: [
      { to: "yuramon", leftover: false, stay: false },
    ],
    egg_v5: [
      { to: "zurumon", leftover: false, stay: false },
    ],
    botamon: [
      { to: "koromon", leftover: false, stay: false },
    ],
    punimon: [
      { to: "tsunomon", leftover: false, stay: false },
    ],
    poyomon: [
      { to: "tokomon", leftover: false, stay: false },
    ],
    yuramon: [
      { to: "tanemon", leftover: false, stay: false },
    ],
    zurumon: [
      { to: "pagumon", leftover: false, stay: false },
    ],
    koromon: [
      { to: "agumon", leftover: false, stay: false, eggKind: "anime_agumon" },
      { to: "agumon", leftover: false, stay: false, calls: [0, 3] },
      { to: "betamon", leftover: false, stay: false, calls: [4, null] },
    ],
    tsunomon: [
      { to: "gabumon", leftover: false, stay: false, eggKind: "anime_gabumon" },
      { to: "gabumon", leftover: false, stay: false, calls: [0, 3] },
      { to: "elecmon", leftover: false, stay: false, calls: [4, null] },
    ],
    tokomon: [
      { to: "patamon", leftover: false, stay: false, calls: [0, 3] },
      { to: "kunemon", leftover: false, stay: false, calls: [4, null] },
    ],
    tanemon: [
      { to: "piyomon", leftover: false, stay: false, calls: [0, 3] },
      { to: "palmon", leftover: false, stay: false, calls: [4, null] },
    ],
    pagumon: [
      { to: "gazimon", leftover: false, stay: false, calls: [0, 3] },
      { to: "gizamon", leftover: false, stay: false, calls: [4, null] },
    ],
    agumon: [
      { to: "greymon", leftover: false, stay: false, eggKind: "anime_agumon" },
      { to: "greymon", leftover: false, stay: false, calls: [0, 3], train: [32, null] },
      { to: "devimon", leftover: false, stay: false, calls: [0, 3], train: [0, 31] },
      { to: "tyranomon", leftover: false, stay: false, calls: [4, null], train: [5, 15], overfeed: [3, null], sleepDist: [0, 4] },
      { to: "meramon", leftover: false, stay: false, calls: [4, null], train: [16, null], overfeed: [3, null], sleepDist: [0, 6] },
      { to: "numemon", leftover: true, stay: false },
    ],
    betamon: [
      { to: "devimon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "meramon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "airdramon", leftover: false, stay: false, calls: [4, null], train: [8, 31], overfeed: [0, 3], sleepDist: [9, null] },
      { to: "seadramon", leftover: false, stay: false, calls: [4, null], train: [8, 31], overfeed: [4, null], sleepDist: [0, 8] },
      { to: "numemon", leftover: true, stay: false },
    ],
    gabumon: [
      { to: "garurumon", leftover: false, stay: false, eggKind: "anime_gabumon" },
      { to: "kabuterimon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "angemon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "garurumon", leftover: false, stay: false, calls: [4, null], train: [5, 31], overfeed: [3, null], sleepDist: [0, 4] },
      { to: "yukidarumon", leftover: false, stay: false, calls: [4, null], train: [32, null], overfeed: [3, null], sleepDist: [0, 6] },
      { to: "vegimon", leftover: true, stay: false },
    ],
    elecmon: [
      { to: "angemon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "birdramon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "yukidarumon", leftover: false, stay: false, calls: [4, null], train: [8, 15], overfeed: [0, 5], sleepDist: [5, null] },
      { to: "whamon", leftover: false, stay: false, calls: [4, null], train: [16, null], overfeed: [6, null], sleepDist: [0, 4] },
      { to: "vegimon", leftover: true, stay: false },
    ],
    patamon: [
      { to: "unimon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "ogremon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "centalmon", leftover: false, stay: false, calls: [4, null], train: [5, 31], overfeed: [3, null], sleepDist: [0, 4] },
      { to: "bakemon", leftover: false, stay: false, calls: [4, null], train: [32, null], overfeed: [3, null], sleepDist: [0, 6] },
      { to: "sukamon", leftover: true, stay: false },
    ],
    kunemon: [
      { to: "ogremon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "shellmon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "bakemon", leftover: false, stay: false, calls: [4, null], train: [8, 15], overfeed: [0, 5], sleepDist: [5, null] },
      { to: "drimogemon", leftover: false, stay: false, calls: [4, null], train: [16, null], overfeed: [6, null], sleepDist: [0, 4] },
      { to: "sukamon", leftover: true, stay: false },
    ],
    piyomon: [
      { to: "monochromon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "leomon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "cockatrimon", leftover: false, stay: false, calls: [4, null], train: [5, 31], overfeed: [3, null], sleepDist: [0, 4] },
      { to: "kuwagamon", leftover: false, stay: false, calls: [4, null], train: [32, null], overfeed: [3, null], sleepDist: [0, 6] },
      { to: "nanimon", leftover: true, stay: false },
    ],
    palmon: [
      { to: "leomon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "coelamon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "kuwagamon", leftover: false, stay: false, calls: [4, null], train: [8, 15], overfeed: [0, 5], sleepDist: [5, null] },
      { to: "mojyamon", leftover: false, stay: false, calls: [4, null], train: [16, null], overfeed: [6, null], sleepDist: [0, 4] },
      { to: "nanimon", leftover: true, stay: false },
    ],
    gazimon: [
      { to: "darktyranomon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "devidramon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "cyclomon", leftover: false, stay: false, calls: [4, null], train: [5, 31], overfeed: [3, null], sleepDist: [0, 4] },
      { to: "tuskmon", leftover: false, stay: false, calls: [4, null], train: [32, null], overfeed: [3, null], sleepDist: [0, 6] },
      { to: "raremon", leftover: true, stay: false },
    ],
    gizamon: [
      { to: "devidramon", leftover: false, stay: false, calls: [0, 3], train: [48, null] },
      { to: "flymon", leftover: false, stay: false, calls: [0, 3], train: [0, 47] },
      { to: "tuskmon", leftover: false, stay: false, calls: [4, null], train: [8, 15], overfeed: [0, 5], sleepDist: [5, null] },
      { to: "deltamon", leftover: false, stay: false, calls: [4, null], train: [32, null], overfeed: [6, null], sleepDist: [0, 4] },
      { to: "raremon", leftover: true, stay: false },
    ],
    greymon: [
      { to: "metalgreymon_va", leftover: false, stay: false, eggKind: "anime_agumon", battles: [15, null], winRate: [0.8, 1.0] },
      { to: "metalgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    devimon: [
      { to: "metalgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    airdramon: [
      { to: "metalgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    tyranomon: [
      { to: "mamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    meramon: [
      { to: "mamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    seadramon: [
      { to: "mamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    numemon: [
      { to: "monzaemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    kabuterimon: [
      { to: "skullgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    angemon: [
      { to: "skullgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    birdramon: [
      { to: "skullgreymon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    garurumon: [
      { to: "weregarurumon", leftover: false, stay: false, eggKind: "anime_gabumon", battles: [15, null], winRate: [0.8, 1.0] },
      { to: "metalmamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    yukidarumon: [
      { to: "metalmamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    whamon: [
      { to: "metalmamemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    vegimon: [
      { to: "vademon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    unimon: [
      { to: "andromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    ogremon: [
      { to: "andromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    shellmon: [
      { to: "andromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    centalmon: [
      { to: "giromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    bakemon: [
      { to: "giromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    drimogemon: [
      { to: "giromon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    sukamon: [
      { to: "etemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    monochromon: [
      { to: "megadramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    leomon: [
      { to: "megadramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    coelamon: [
      { to: "megadramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    cockatrimon: [
      { to: "piccolomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    kuwagamon: [
      { to: "piccolomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    mojyamon: [
      { to: "piccolomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    nanimon: [
      { to: "digitamamon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    darktyranomon: [
      { to: "metaltyranomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    devidramon: [
      { to: "metaltyranomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    flymon: [
      { to: "metaltyranomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    cyclomon: [
      { to: "nanomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    tuskmon: [
      { to: "nanomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    deltamon: [
      { to: "nanomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    raremon: [
      { to: "extyranomon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    metalgreymon: [
      { to: "blitzgreymon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    mamemon: [
      { to: "banchomamemon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    monzaemon: [
      { to: null, leftover: true, stay: true, reason: "no-mega-from-this-ultimate" },
    ],
    skullgreymon: [
      { to: "skullmammon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    metalmamemon: [
      { to: "cresgarurumon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    vademon: [
      { to: null, leftover: true, stay: true, reason: "no-mega-from-this-ultimate" },
    ],
    andromon: [
      { to: "hiandromon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    giromon: [
      { to: null, leftover: true, stay: true, reason: "no-mega-from-this-ultimate" },
    ],
    etemon: [
      { to: "kingetemon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    megadramon: [
      { to: "aegisdramon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    piccolomon: [
      { to: null, leftover: true, stay: true, reason: "no-mega-from-this-ultimate" },
    ],
    digitamamon: [
      { to: "titamon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    metaltyranomon: [
      { to: "mugendramon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    nanomon: [
      { to: null, leftover: true, stay: true, reason: "no-mega-from-this-ultimate" },
    ],
    extyranomon: [
      { to: "pinochimon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    metalgreymon_va: [
      { to: "wargreymon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    weregarurumon: [
      { to: "metalgarurumon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    egg_zuba: [
      { to: "sakumon", leftover: false, stay: false },
    ],
    egg_hack: [
      { to: "sakumon", leftover: false, stay: false },
    ],
    egg_dra_blue: [
      { to: "petitmon", leftover: false, stay: false },
    ],
    egg_dra_green: [
      { to: "petitmon", leftover: false, stay: false },
    ],
    egg_doru: [
      { to: "dodomon", leftover: false, stay: false },
    ],
    egg_anime_agumon: [
      { to: "botamon", leftover: false, stay: false },
    ],
    egg_anime_gabumon: [
      { to: "punimon", leftover: false, stay: false },
    ],
    egg_corona: [
      { to: "pichimon", leftover: false, stay: false },
    ],
    egg_luna: [
      { to: "pichimon", leftover: false, stay: false },
    ],
    egg_meicoo: [
      { to: "yukimibotamon", leftover: false, stay: false },
    ],
    sakumon: [
      { to: "sakuttomon", leftover: false, stay: false },
    ],
    sakuttomon: [
      { to: "zubamon", leftover: false, stay: false, eggKind: "zuba" },
      { to: "hackmon", leftover: false, stay: false, eggKind: "hack" },
    ],
    zubamon: [
      { to: "zubaeagermon", leftover: false, stay: false },
    ],
    zubaeagermon: [
      { to: "duramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    duramon: [
      { to: "durandamon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    hackmon: [
      { to: "baohackmon", leftover: false, stay: false },
    ],
    baohackmon: [
      { to: "saviorhackmon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    saviorhackmon: [
      { to: "jesmon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    petitmon: [
      { to: "babydmon", leftover: false, stay: false },
    ],
    babydmon: [
      { to: "dracomon", leftover: false, stay: false },
    ],
    dracomon: [
      { to: "coredramon_blue", leftover: false, stay: false, eggKind: "dra_blue" },
      { to: "coredramon_green", leftover: false, stay: false, eggKind: "dra_green" },
    ],
    coredramon_blue: [
      { to: "wingdramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    wingdramon: [
      { to: "slayerdramon", leftover: false, stay: false, calls: [0, 2] },
      { to: "wargreymon", leftover: false, stay: false, calls: [3, 4], battles: [100, null] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    coredramon_green: [
      { to: "groundramon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    groundramon: [
      { to: "breakdramon", leftover: false, stay: false, calls: [0, 2] },
      { to: "metalgarurumon", leftover: false, stay: false, calls: [3, 4], battles: [100, null] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    dodomon: [
      { to: "dorimon", leftover: false, stay: false },
    ],
    dorimon: [
      { to: "dorumon", leftover: false, stay: false },
    ],
    dorumon: [
      { to: "dorugamon", leftover: false, stay: false },
    ],
    dorugamon: [
      { to: "doruguremon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    doruguremon: [
      { to: "alphamon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    pichimon: [
      { to: "pukamon", leftover: false, stay: false },
    ],
    pukamon: [
      { to: "coronamon", leftover: false, stay: false, eggKind: "corona" },
      { to: "lunamon", leftover: false, stay: false, eggKind: "luna" },
    ],
    coronamon: [
      { to: "firamon", leftover: false, stay: false },
    ],
    firamon: [
      { to: "flaremon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    flaremon: [
      { to: "apollomon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    lunamon: [
      { to: "lekismon", leftover: false, stay: false },
    ],
    lekismon: [
      { to: "crescemon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    crescemon: [
      { to: "dianamon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
    yukimibotamon: [
      { to: "nyaromon", leftover: false, stay: false },
    ],
    nyaromon: [
      { to: "plotmon", leftover: false, stay: false },
    ],
    plotmon: [
      { to: "meicoomon", leftover: false, stay: false },
    ],
    meicoomon: [
      { to: "meicrackmon", leftover: false, stay: false, battles: [15, null], winRate: [0.8, 1.0] },
      { to: null, leftover: true, stay: true, reason: "ultimate-requirements-not-met" },
    ],
    meicrackmon: [
      { to: "rasielmon", leftover: false, stay: false, calls: [0, 2] },
      { to: null, leftover: true, stay: true, reason: "mega-requirements-not-met" },
    ],
  };
  var JOGRESS = [{ a: "blitzgreymon", b: "cresgarurumon", to: "omegamon_alters", tagWins: 5, nameZh: "奧米加獸 Alter-S", nameEn: "Omegamon Alter-S", note: "20th：標籤對戰 5 勝後合體。" }, { a: "aegisdramon", b: "mugendramon", to: "lasttyranomon", tagWins: 5, nameZh: "終極巨龍獸", nameEn: "LastTyranomon", note: "20th：標籤對戰 5 勝。" }, { a: "wargreymon", b: "metalgarurumon", to: "omegamon", tagWins: 5, nameZh: "奧米加獸", nameEn: "Omegamon", note: "20th：戰鬥暴龍獸與鋼鐵加魯魯獸標籤對戰 5 勝（可選限定路線）。" }, { a: "slayerdramon", b: "breakdramon", to: "examon", tagWins: 5, nameZh: "艾克薩獸", nameEn: "Examon", note: "20th：標籤對戰 5 勝後合體。" }, { a: "apollomon", b: "dianamon", to: "gracenovamon", tagWins: 5, nameZh: "優雅新星獸", nameEn: "GraceNovamon", note: "20th：標籤對戰 5 勝後合體（兩顆限定蛋）。" }];
  var SPECIAL_EGGS = {
    zuba: { nameZh: "茲巴數碼蛋（20th特殊）", nameEn: "Zuba Digitama (20th special)", eggId: "egg_zuba", hatch: "sakumon", unlock: "對戰累計 100 勝", line: ["sakumon", "sakuttomon", "zubamon", "zubaeagermon", "duramon", "durandamon"], note: "全版本：戰鬥模式累計 100 勝後可選。共享幼年期薩庫獸／薩庫托獸，以 eggKind 分支。" },
    hack: { nameZh: "哈克數碼蛋（20th特殊）", nameEn: "Hack Digitama (20th special)", eggId: "egg_hack", hatch: "sakumon", unlock: "對戰累計 50 勝", line: ["sakumon", "sakuttomon", "hackmon", "baohackmon", "saviorhackmon", "jesmon"], note: "全版本：戰鬥模式累計 50 勝後可選。" },
    dra_blue: { nameZh: "龍仔獸藍蛋／斬龍（20th特殊）", nameEn: "Slayerdra Digitama (20th special, black egg)", eggId: "egg_dra_blue", hatch: "petitmon", unlock: "圖鑑登錄 5 體以上", line: ["petitmon", "babydmon", "dracomon", "coredramon_blue", "wingdramon", "slayerdramon"], note: "官方為黑蛋。翔龍獸在育成ミス 3–4 且對戰 100 場以上時可變戰鬥暴龍獸（日本版僅後發三色；海外／NEW WAVE 全色可進化）。" },
    dra_green: { nameZh: "龍仔獸綠蛋／破壞龍（20th特殊）", nameEn: "Breakdra Digitama (20th special, white egg)", eggId: "egg_dra_green", hatch: "petitmon", unlock: "圖鑑登錄 25 體以上", line: ["petitmon", "babydmon", "dracomon", "coredramon_green", "groundramon", "breakdramon"], note: "官方為白蛋。地龍獸在育成ミス 3–4 且對戰 100 場以上時可變鋼鐵加魯魯獸（日本版僅後發三色）。" },
    doru: { nameZh: "多路數碼蛋（20th特殊）", nameEn: "Doru Digitama (20th special)", eggId: "egg_doru", hatch: "dodomon", unlock: "WAVE1（棕／灰）與 WAVE2（α／茲巴／奧米加）通信", line: ["dodomon", "dorimon", "dorumon", "dorugamon", "doruguremon", "alphamon"], note: "兩台成功連線後雙方解鎖。" },
    anime_agumon: { nameZh: "動畫亞古獸數碼蛋（20th限定）", nameEn: "Anime Agumon Digitama (20th exclusive)", eggId: "egg_anime_agumon", hatch: "botamon", unlock: "與 5 個不同訓練師名稱的 20th 通信", line: ["botamon", "koromon", "agumon", "greymon", "metalgreymon_va", "wargreymon"], note: "官方 Ver.1 究極體為電光暴龍獸，不是戰鬥暴龍獸。此蛋為線性路線（條件無）。" },
    anime_gabumon: { nameZh: "動畫加布獸數碼蛋（20th限定）", nameEn: "Anime Gabumon Digitama (20th exclusive)", eggId: "egg_anime_gabumon", hatch: "punimon", unlock: "與 5 個不同訓練師名稱的 20th 通信", line: ["punimon", "tsunomon", "gabumon", "garurumon", "weregarurumon", "metalgarurumon"], note: "官方 Ver.2 從鋼鐵豆豆獸進化的究極體是偃月加魯魯獸，不是鋼鐵加魯魯獸。" },
    corona: { nameZh: "日冕數碼蛋（20th限定）", nameEn: "Corona Digitama (20th exclusive)", eggId: "egg_corona", hatch: "pichimon", unlock: "與 5 個不同訓練師名稱的 20th 通信", line: ["pichimon", "pukamon", "coronamon", "firamon", "flaremon", "apollomon"], note: "奧米加獸配色機限定蛋。與露娜蛋共享比基獸／布加獸。" },
    luna: { nameZh: "露娜數碼蛋（20th限定）", nameEn: "Luna Digitama (20th exclusive)", eggId: "egg_luna", hatch: "pichimon", unlock: "與 5 個不同訓練師名稱的 20th 通信", line: ["pichimon", "pukamon", "lunamon", "lekismon", "crescemon", "dianamon"], note: "阿爾法獸配色機限定蛋。" },
    meicoo: { nameZh: "梅可可數碼蛋（20th限定）", nameEn: "Meicoo Digitama (20th exclusive)", eggId: "egg_meicoo", hatch: "yukimibotamon", unlock: "與 5 個不同訓練師名稱的 20th 通信", line: ["yukimibotamon", "nyaromon", "plotmon", "meicoomon", "meicrackmon", "rasielmon"], note: "茲巴獸配色機限定蛋。完全體 Mega 為拉結爾獸（Rasielmon），不是病毒種的 Raguelmon。" }
  };
  var NOTES = { sources: ["Rookie and Champion branches: Wikimon Digital Monster Ver.1–Ver.5 (original 1997–1998 device conditions), including sleep disturbances, training counts, overfeed, and care mistakes (calls).", "Ver.1 training: any training session counts (even fail/cancel). Ver.2–5: only successful training counts (Wikimon).", "Care mistakes (calls): 0–3 = regular / 4+ = irregular on the original devices. A hunger+strength double call still counts as one mistake. Lights left on 20 minutes after sleep also counts.", "Counters (calls, train, overfeed, sleep disturbances, injuries, and the internal battle record used for evolution) RESET when the Digimon evolves. The status screen also shows lifetime battle totals (original device 通算成績), which do not decide evolution.", "Champion → Ultimate (完全體): 15 or more battles during the Champion stage AND a win rate of 80% or higher. CPU and online PvP both increment the same counters. If the check fails, the Digimon stays Champion.", "Ultimate → Mega (究極體): Digital Monster Ver.20th official conditions — 育成ミス 2回以下 (0–2 care mistakes) during the Ultimate stage. Japanese 20th guide wording is used (2回以下). Wikimon’s English “less than 2” would be 0–1; this table follows 2回以下 = 0–2. Battle count is not required for these standard Ver.1–5 megas.", "These ultimates have no Mega in Ver.20th: Monzaemon, Vademon, Giromon, Piccolomon, Nanomon.", "Standard Ver.1 Mega is BlitzGreymon (not WarGreymon). Standard Ver.2 Mega from MetalMamemon is CresGarurumon (not MetalGarurumon). WarGreymon / MetalGarurumon appear on optional 20th exclusive anime Digitama.", "Jogress (optional): tag-battle 5 wins with the official partner (BlitzGreymon+CresGarurumon→Omegamon Alter-S; Aegisdramon+Mugendramon→LastTyranomon/RustTyranomon; WarGreymon+MetalGarurumon→Omegamon; Slayerdramon+Breakdramon→Examon; Apollomon+Dianamon→GraceNovamon).", "20th special Digitama (Zuba/Hack/Slayerdra/Breakdra/Doru) and exclusive Digitama (anime Agumon/Gabumon, Corona, Luna, Meicoo) use eggKind on shared babies. Special-line Rookie→Champion is unconditional; Champion→Ultimate uses the standard 15 battles / 80%+ win rate; Ultimate→Mega is 0–2 care mistakes. Hidden: Wingdramon→WarGreymon and Groundramon→MetalGarurumon if 3–4 care mistakes and 100+ battles (Japan wave-2 colors only; overseas / NEW WAVE all colors).", "20th official raisable count is 134 (nhoko / Humulos IDs 0–133). Colosseum-only and Digital Monster Color-only forms are documented in roster-audit.md and are not in this table.", "Weight is reserved in the condition schema; official Ver.1–5 and 20th Ver.1–5 egg lines do not use weight as an evolution gate.", "Stage times in this table are defaults for the simulator (egg 10 min, Baby I 60 min, Baby II 24 h, Rookie 72 h, Champion 72 h, Ultimate 48 h). Original individual lifespans varied by species (e.g. Koromon often cited ~44 h)."] };
  var data = { STAGES: STAGES, VERSIONS: VERSIONS, MONSTERS: MONSTERS, BRANCHES: BRANCHES, JOGRESS: JOGRESS, SPECIAL_EGGS: SPECIAL_EGGS, NOTES: NOTES };
  if (typeof module !== 'undefined' && module.exports) { module.exports = data; }
  root.EvolutionData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
