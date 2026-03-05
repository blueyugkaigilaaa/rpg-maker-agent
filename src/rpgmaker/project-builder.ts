import * as fs from "fs";
import * as path from "path";
import {
  MZ_Map, MZ_Actor, MZ_System, MZ_MapInfo, MZ_CommonEvent, MZ_Tileset, MZ_Class,
} from "./types";

export interface ProjectFiles {
  maps: { id: number; data: MZ_Map }[];
  mapInfos: (MZ_MapInfo | null)[];
  actors: (MZ_Actor | null)[];
  system: MZ_System;
  commonEvents: (MZ_CommonEvent | null)[];
}

/**
 * Build a complete RPG Maker MZ project directory.
 */
export async function buildProject(
  outputDir: string,
  templateDir: string,
  project: ProjectFiles
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });

  await copyTemplateAssets(outputDir, templateDir);

  const dataDir = path.join(outputDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  for (const { id, data } of project.maps) {
    const filename = `Map${String(id).padStart(3, "0")}.json`;
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data));
  }

  fs.writeFileSync(path.join(dataDir, "MapInfos.json"), JSON.stringify(project.mapInfos));
  fs.writeFileSync(path.join(dataDir, "Actors.json"), JSON.stringify(project.actors));
  fs.writeFileSync(path.join(dataDir, "System.json"), JSON.stringify(project.system));
  fs.writeFileSync(path.join(dataDir, "CommonEvents.json"), JSON.stringify(project.commonEvents));

  // Copy other required data files from template if they don't already exist
  const requiredDataFiles = [
    "Animations.json", "Armors.json", "Classes.json",
    "Enemies.json", "Items.json", "Skills.json",
    "States.json", "Tilesets.json", "Troops.json", "Weapons.json",
  ];

  const templateDataDir = path.join(templateDir, "data");
  for (const file of requiredDataFiles) {
    const dest = path.join(dataDir, file);
    if (!fs.existsSync(dest)) {
      const src = path.join(templateDataDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }
}

/**
 * Copy template assets (js, css, img, audio, fonts, icon, index.html) from the base MZ project.
 */
async function copyTemplateAssets(outputDir: string, templateDir: string): Promise<void> {
  const dirs = ["js", "css", "img", "audio", "fonts", "icon", "effects"];

  for (const dir of dirs) {
    const src = path.join(templateDir, dir);
    const dest = path.join(outputDir, dir);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  const copyOnlyFiles = ["package.json"];
  for (const file of copyOnlyFiles) {
    const src = path.join(templateDir, file);
    const dest = path.join(outputDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  writeGameIndex(outputDir);
  patchGameCss(path.join(outputDir, "css", "game.css"));
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create a default System.json with sensible defaults for a generated game.
 */
export function createDefaultSystem(
  gameTitle: string,
  startMapId: number,
  startX: number,
  startY: number,
  partyMembers: number[] = [1]
): MZ_System {
  return {
    advanced: {
      gameId: Math.floor(Math.random() * 1000000),
      screenWidth: 816,
      screenHeight: 624,
      uiAreaWidth: 816,
      uiAreaHeight: 624,
      numberFontFilename: "mplus-2p-bold-sub.woff",
      fallbackFonts: "Verdana, sans-serif",
      fontSize: 26,
      mainFontFilename: "mplus-1m-regular.woff",
      windowOpacity: 192,
    },
    airship: emptyVehicle(),
    armorTypes: ["", "General Armor", "Magic Armor", "Light Armor", "Heavy Armor", "Small Shield", "Large Shield"],
    attackMotions: [
      { type: 0, weaponImageId: 0 },
      { type: 1, weaponImageId: 1 },
      { type: 1, weaponImageId: 2 },
      { type: 1, weaponImageId: 3 },
      { type: 1, weaponImageId: 4 },
      { type: 1, weaponImageId: 5 },
      { type: 1, weaponImageId: 6 },
      { type: 2, weaponImageId: 7 },
      { type: 2, weaponImageId: 8 },
      { type: 2, weaponImageId: 9 },
      { type: 0, weaponImageId: 10 },
      { type: 0, weaponImageId: 11 },
      { type: 0, weaponImageId: 12 },
    ],
    battleBgm: { name: "Battle1", volume: 90, pitch: 100, pan: 0 },
    battleback1Name: "",
    battleback2Name: "",
    battlerHue: 0,
    battlerName: "",
    battleSystem: 0,
    boat: emptyVehicle(),
    currencyUnit: "G",
    defeatMe: { name: "Defeat1", volume: 90, pitch: 100, pan: 0 },
    editMapId: 1,
    elements: ["", "Physical", "Fire", "Ice", "Thunder", "Water", "Earth", "Wind", "Light", "Darkness"],
    equipTypes: ["", "Weapon", "Shield", "Head", "Body", "Accessory"],
    gameTitle,
    gameoverMe: { name: "Gameover1", volume: 90, pitch: 100, pan: 0 },
    locale: "en_US",
    magicSkills: [1],
    menuCommands: [true, true, true, true, true, true],
    optAutosave: false,
    optDisplayTp: true,
    optDrawTitle: true,
    optExtraExp: false,
    optFloorDeath: false,
    optFollowers: false,
    optKeyItemsNumber: false,
    optSideView: true,
    optSlipDeath: false,
    optTransparent: false,
    partyMembers,
    ship: emptyVehicle(),
    skillTypes: ["", "Magic", "Special"],
    sounds: [
      { name: "Cursor3", volume: 90, pitch: 100, pan: 0 },
      { name: "Decision2", volume: 90, pitch: 100, pan: 0 },
      { name: "Cancel2", volume: 90, pitch: 100, pan: 0 },
      { name: "Buzzer1", volume: 90, pitch: 100, pan: 0 },
      { name: "Equip1", volume: 90, pitch: 100, pan: 0 },
      { name: "Save2", volume: 90, pitch: 100, pan: 0 },
      { name: "Load2", volume: 90, pitch: 100, pan: 0 },
      { name: "Battle1", volume: 90, pitch: 100, pan: 0 },
      { name: "Run", volume: 90, pitch: 100, pan: 0 },
      { name: "Attack3", volume: 90, pitch: 100, pan: 0 },
      { name: "Damage4", volume: 90, pitch: 100, pan: 0 },
      { name: "Collapse1", volume: 90, pitch: 100, pan: 0 },
      { name: "Collapse2", volume: 90, pitch: 100, pan: 0 },
      { name: "Collapse3", volume: 90, pitch: 100, pan: 0 },
      { name: "Collapse4", volume: 90, pitch: 100, pan: 0 },
      { name: "Recovery", volume: 90, pitch: 100, pan: 0 },
      { name: "Miss", volume: 90, pitch: 100, pan: 0 },
      { name: "Evasion1", volume: 90, pitch: 100, pan: 0 },
      { name: "Evasion2", volume: 90, pitch: 100, pan: 0 },
      { name: "Reflection", volume: 90, pitch: 100, pan: 0 },
      { name: "Shop1", volume: 90, pitch: 100, pan: 0 },
      { name: "Item3", volume: 90, pitch: 100, pan: 0 },
    ],
    startMapId,
    startX,
    startY,
    switches: buildArray(50, ""),
    terms: {
      basic: ["Level", "Lv", "HP", "HP", "MP", "MP", "TP", "TP", "EXP", "EXP"],
      commands: [
        "Fight", "Escape", "Attack", "Guard", "Item", "Skill",
        "Equip", "Status", "Formation", "Save", "Game End",
        "Options", "Weapon", "Armor", "Key Item", "Equip",
        "Optimize", "Clear", "New Game", "Continue",
        null, "To Title", "Cancel", null, "Buy", "Sell",
      ],
      params: ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "Hit", "Evasion"],
      messages: {
        alwaysDash: "Always Dash",
        commandRemember: "Command Remember",
        touchUI: "Touch UI",
        bgmVolume: "BGM Volume",
        bgsVolume: "BGS Volume",
        meVolume: "ME Volume",
        seVolume: "SE Volume",
        possession: "Possession",
        expTotal: "Current %1",
        expNext: "To Next %1",
        saveMessage: "Which file would you like to save to?",
        loadMessage: "Which file would you like to load?",
        file: "File",
        autosave: "Autosave",
        partyName: "%1's Party",
        emerge: "%1 emerged!",
        preemptive: "%1 got the upper hand!",
        surprise: "%1 was surprised!",
        escapeStart: "%1 has started to escape!",
        escapeFailure: "However, it was unable to escape!",
        victory: "%1 was victorious!",
        defeat: "%1 was defeated.",
        obtainExp: "%1 %2 received!",
        obtainGold: "%1\\G found!",
        obtainItem: "%1 found!",
        levelUp: "%1 is now %2 %3!",
        obtainSkill: "%1 learned!",
        useItem: "%1 uses %2!",
        criticalToEnemy: "An excellent hit!!",
        criticalToActor: "A painful blow!!",
        actorDamage: "%1 took %2 damage!",
        actorRecovery: "%1 recovered %2 %3!",
        actorGain: "%1 gained %2 %3!",
        actorLoss: "%1 lost %2 %3!",
        actorDrain: "%1 was drained of %2 %3!",
        actorNoDamage: "%1 took no damage!",
        actorNoHit: "Miss! %1 took no damage!",
        enemyDamage: "%1 took %2 damage!",
        enemyRecovery: "%1 recovered %2 %3!",
        enemyGain: "%1 gained %2 %3!",
        enemyLoss: "%1 lost %2 %3!",
        enemyDrain: "%1 was drained of %2 %3!",
        enemyNoDamage: "%1 took no damage!",
        enemyNoHit: "Miss! %1 took no damage!",
        evasion: "%1 evaded the attack!",
        magicEvasion: "%1 nullified the magic!",
        magicReflection: "%1 reflected the magic!",
        counterAttack: "%1 made a counterattack!",
        substitute: "%1 protected %2!",
        buffAdd: "%1's %2 went up!",
        debuffAdd: "%1's %2 went down!",
        buffRemove: "%1's %2 returned to normal!",
        actionFailure: "There was no effect on %1!",
      },
    },
    testBattlers: [{ actorId: 1, equips: [0, 0, 0, 0, 0], level: 1 }],
    testTroopId: 1,
    title1Name: "",
    title2Name: "",
    titleBgm: { name: "Theme4", volume: 90, pitch: 100, pan: 0 },
    titleCommandWindow: { background: 0, offsetX: 0, offsetY: 0 },
    variables: buildArray(50, ""),
    versionId: 1,
    victoryMe: { name: "Victory1", volume: 90, pitch: 100, pan: 0 },
    weaponTypes: ["", "Dagger", "Sword", "Flail", "Axe", "Whip", "Staff", "Bow", "Crossbow", "Gun", "Claw", "Glove", "Spear"],
    windowTone: [0, 0, 0, 0],
  };
}

function emptyVehicle() {
  return {
    bgm: { name: "", volume: 90, pitch: 100, pan: 0 },
    characterIndex: 0,
    characterName: "",
    startMapId: 0,
    startX: 0,
    startY: 0,
  };
}

function buildArray(size: number, defaultVal: string): string[] {
  return Array.from({ length: size + 1 }, () => defaultVal);
}

/**
 * Create a basic Actor entry.
 */
export function createActor(
  id: number,
  name: string,
  characterName: string,
  characterIndex: number,
  faceName: string,
  faceIndex: number
): MZ_Actor {
  return {
    id,
    name,
    nickname: "",
    classId: 1,
    battlerName: "",
    characterIndex,
    characterName,
    faceIndex,
    faceName,
    equips: [0, 0, 0, 0, 0],
    initialLevel: 1,
    maxLevel: 99,
    traits: [],
    note: "",
    profile: "",
  };
}

/**
 * Create a MapInfo entry.
 */
/**
 * Write index.html that forces the RPG Maker MZ stretch mode on,
 * so the game canvas scales to fit the browser viewport (shortest edge).
 */
function writeGameIndex(outputDir: string): void {
  const html = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="viewport" content="user-scalable=no">
        <link rel="icon" href="icon/icon.png" type="image/png">
        <link rel="apple-touch-icon" href="icon/icon.png">
        <link rel="stylesheet" type="text/css" href="css/game.css">
        <title></title>
    </head>
    <body style="background-color: black">
        <script>
        window.addEventListener("load", function() {
            if (typeof Graphics !== "undefined") {
                Graphics._defaultStretchMode = function() { return true; };
            }
        });
        </script>
        <script type="text/javascript" src="js/main.js"></script>
    </body>
</html>
`;
  fs.writeFileSync(path.join(outputDir, "index.html"), html);
}

/**
 * Append body styles to game.css so that document.body fills the full
 * viewport — required for Graphics._stretchWidth/Height to work correctly.
 */
function patchGameCss(cssPath: string): void {
  if (!fs.existsSync(cssPath)) return;

  const patch = `
body {
    margin: 0;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
}
`;
  fs.appendFileSync(cssPath, patch);
}

export function createMapInfo(
  id: number,
  name: string,
  parentId: number = 0,
  order: number = 1
): MZ_MapInfo {
  return {
    id,
    expanded: false,
    name,
    order,
    parentId,
    scrollX: 0,
    scrollY: 0,
  };
}
