import { MZ_EventCommand, MZ_AudioFile } from "./types";
import { CMD } from "./constants";

/**
 * Fluent builder for RPG Maker MZ event command lists.
 * Usage:
 *   const cmds = new EventBuilder()
 *     .showText("Actor1", 0, "Hello!", "Reid")
 *     .showChoices(["Yes", "No"])
 *     .whenChoice(0, b => b.showText("", 0, "Great!"))
 *     .whenChoice(1, b => b.showText("", 0, "Too bad."))
 *     .end()
 *     .build();
 */
export class EventBuilder {
  private commands: MZ_EventCommand[] = [];
  private currentIndent: number = 0;

  private push(code: number, parameters: unknown[] = []): this {
    this.commands.push({ code, indent: this.currentIndent, parameters });
    return this;
  }

  // ---- Message Commands ----

  showText(
    faceName: string,
    faceIndex: number,
    lines: string | string[],
    speakerName: string = "",
    background: number = 0,
    position: number = 2
  ): this {
    const maxLen = faceName ? 20 : 28;
    const allLines = Array.isArray(lines)
      ? lines.map((l) => String(l ?? ""))
      : splitTextLines(lines == null ? "" : lines, maxLen);

    for (let i = 0; i < allLines.length; i += 4) {
      this.push(CMD.SHOW_TEXT, [faceName, faceIndex, background, position, speakerName]);
      const chunk = allLines.slice(i, i + 4);
      for (const line of chunk) {
        this.push(CMD.SHOW_TEXT_LINE, [line]);
      }
    }
    return this;
  }

  showChoices(
    choices: string[],
    cancelType: number = -1,
    defaultType: number = 0,
    positionType: number = 2,
    background: number = 0
  ): this {
    this.push(CMD.SHOW_CHOICES, [choices, cancelType, defaultType, positionType, background]);
    return this;
  }

  whenChoice(index: number, branch?: (builder: EventBuilder) => void): this {
    this.push(CMD.WHEN_CHOICE, [index]);
    if (branch) {
      this.currentIndent++;
      branch(this);
      this.currentIndent--;
    }
    return this;
  }

  whenCancel(branch?: (builder: EventBuilder) => void): this {
    this.push(CMD.WHEN_CANCEL, []);
    if (branch) {
      this.currentIndent++;
      branch(this);
      this.currentIndent--;
    }
    return this;
  }

  endChoices(): this {
    return this;
  }

  comment(text: string): this {
    const lines = (text ?? "").split("\n");
    this.push(CMD.COMMENT, [lines[0]]);
    for (let i = 1; i < lines.length; i++) {
      this.push(CMD.COMMENT_LINE, [lines[i]]);
    }
    return this;
  }

  // ---- Flow Control ----

  conditionalBranch_switch(switchId: number, value: boolean): this {
    this.push(CMD.CONDITIONAL_BRANCH, [0, switchId, value ? 0 : 1]);
    this.currentIndent++;
    return this;
  }

  conditionalBranch_variable(
    varId: number,
    compareValue: number,
    operator: number = 0 // 0=equal, 1=>=, 2=<=, 3=>, 4=<, 5=!=
  ): this {
    this.push(CMD.CONDITIONAL_BRANCH, [1, varId, 0, compareValue, operator]);
    this.currentIndent++;
    return this;
  }

  conditionalBranch_selfSwitch(ch: string, value: boolean): this {
    this.push(CMD.CONDITIONAL_BRANCH, [2, ch, value ? 0 : 1]);
    this.currentIndent++;
    return this;
  }

  elseBranch(): this {
    this.currentIndent--;
    this.push(CMD.ELSE, []);
    this.currentIndent++;
    return this;
  }

  endBranch(): this {
    this.currentIndent--;
    this.push(CMD.END, []);
    return this;
  }

  exitEvent(): this {
    this.push(CMD.EXIT_EVENT, []);
    return this;
  }

  label(name: string): this {
    this.push(CMD.LABEL, [name]);
    return this;
  }

  jumpToLabel(name: string): this {
    this.push(CMD.JUMP_TO_LABEL, [name]);
    return this;
  }

  commonEvent(id: number): this {
    this.push(CMD.COMMON_EVENT, [id]);
    return this;
  }

  // ---- Switches / Variables ----

  controlSwitch(startId: number, endId: number, value: boolean): this {
    this.push(CMD.CONTROL_SWITCHES, [startId, endId, value ? 0 : 1]);
    return this;
  }

  setSelfSwitch(ch: string, value: boolean): this {
    this.push(CMD.CONTROL_SELF_SWITCH, [ch, value ? 0 : 1]);
    return this;
  }

  setVariable(varId: number, value: number): this {
    this.push(CMD.CONTROL_VARIABLES, [varId, varId, 0, 0, value]);
    return this;
  }

  addVariable(varId: number, value: number): this {
    this.push(CMD.CONTROL_VARIABLES, [varId, varId, 1, 0, value]);
    return this;
  }

  // ---- Transfer / Movement ----

  transferPlayer(
    mapId: number,
    x: number,
    y: number,
    direction: number = 0,
    fadeType: number = 0
  ): this {
    this.push(CMD.TRANSFER_PLAYER, [0, mapId, x, y, direction, fadeType]);
    return this;
  }

  // ---- Screen Effects ----

  fadeoutScreen(): this {
    this.push(CMD.FADEOUT_SCREEN, []);
    return this;
  }

  fadeinScreen(): this {
    this.push(CMD.FADEIN_SCREEN, []);
    return this;
  }

  tintScreen(
    tone: [number, number, number, number],
    duration: number = 60,
    waitForCompletion: boolean = true
  ): this {
    this.push(CMD.TINT_SCREEN, [tone, duration, waitForCompletion]);
    return this;
  }

  flashScreen(
    color: [number, number, number, number],
    duration: number = 8,
    waitForCompletion: boolean = true
  ): this {
    this.push(CMD.FLASH_SCREEN, [color, duration, waitForCompletion]);
    return this;
  }

  shakeScreen(
    power: number = 5,
    speed: number = 5,
    duration: number = 20,
    waitForCompletion: boolean = true
  ): this {
    this.push(CMD.SHAKE_SCREEN, [power, speed, duration, waitForCompletion]);
    return this;
  }

  wait(frames: number): this {
    this.push(CMD.WAIT, [frames]);
    return this;
  }

  // ---- Audio ----

  playBGM(name: string, volume: number = 90, pitch: number = 100, pan: number = 0): this {
    this.push(CMD.PLAY_BGM, [{ name, volume, pitch, pan }]);
    return this;
  }

  fadeoutBGM(duration: number = 10): this {
    this.push(CMD.FADEOUT_BGM, [duration]);
    return this;
  }

  playBGS(name: string, volume: number = 90, pitch: number = 100, pan: number = 0): this {
    this.push(CMD.PLAY_BGS, [{ name, volume, pitch, pan }]);
    return this;
  }

  playSE(name: string, volume: number = 90, pitch: number = 100, pan: number = 0): this {
    this.push(CMD.PLAY_SE, [{ name, volume, pitch, pan }]);
    return this;
  }

  playME(name: string, volume: number = 90, pitch: number = 100, pan: number = 0): this {
    this.push(CMD.PLAY_ME, [{ name, volume, pitch, pan }]);
    return this;
  }

  // ---- Character ----

  showBalloonIcon(characterId: number, balloonId: number, waitForCompletion: boolean = false): this {
    this.push(CMD.SHOW_BALLOON_ICON, [characterId, balloonId, waitForCompletion]);
    return this;
  }

  eraseEvent(): this {
    this.push(CMD.ERASE_EVENT, []);
    return this;
  }

  changeTransparency(transparent: boolean): this {
    this.push(CMD.CHANGE_TRANSPARENCY, [transparent ? 0 : 1]);
    return this;
  }

  // ---- Actor ----

  changeActorImages(
    actorId: number,
    characterName: string,
    characterIndex: number,
    faceName: string,
    faceIndex: number,
    svBattlerName: string = "",
    svBattlerIndex: number = 0,
  ): this {
    this.push(CMD.CHANGE_ACTOR_IMAGES, [
      actorId, characterName, characterIndex,
      faceName, faceIndex,
      svBattlerName, svBattlerIndex,
    ]);
    return this;
  }

  changePartyMember(actorId: number, add: boolean, initialize: boolean = true): this {
    this.push(CMD.CHANGE_PARTY_MEMBER, [actorId, add ? 0 : 1, initialize ? 1 : 0]);
    return this;
  }

  // ---- Scene ----

  gameOver(): this {
    this.push(CMD.GAME_OVER, []);
    return this;
  }

  returnToTitle(): this {
    this.push(CMD.RETURN_TO_TITLE, []);
    return this;
  }

  script(code: string): this {
    const lines = (code ?? "").split("\n");
    this.push(CMD.SCRIPT, [lines[0]]);
    for (let i = 1; i < lines.length; i++) {
      this.push(CMD.SCRIPT_LINE, [lines[i]]);
    }
    return this;
  }

  // ---- Build ----

  end(): this {
    this.push(CMD.END, []);
    return this;
  }

  build(): MZ_EventCommand[] {
    const result = [...this.commands];
    if (result.length === 0 || result[result.length - 1].code !== CMD.END) {
      result.push({ code: CMD.END, indent: 0, parameters: [] });
    }
    return result;
  }
}

function splitTextLines(text: string, maxLineLength: number = 20): string[] {
  const lines: string[] = [];
  const paragraphs = (text ?? "").split("\n");
  const punctuation = "。，、；：！？）》」』】〉…—";

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLineLength) {
      lines.push(paragraph);
    } else {
      let remaining = paragraph;
      while (remaining.length > maxLineLength) {
        let splitAt = -1;
        for (let i = maxLineLength; i > 0; i--) {
          if (punctuation.includes(remaining[i - 1])) {
            splitAt = i;
            break;
          }
        }
        if (splitAt <= 0) {
          const spaceAt = remaining.lastIndexOf(" ", maxLineLength);
          splitAt = spaceAt > 0 ? spaceAt + 1 : maxLineLength;
        }
        lines.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt);
      }
      if (remaining) lines.push(remaining);
    }
  }

  return lines;
}

/**
 * Build a complete dialogue event with optional choices.
 * Convenience function wrapping EventBuilder for the most common pattern.
 */
export function buildDialogueEvent(
  dialogueLines: { face: string; faceIndex: number; speaker: string; text: string }[],
  choices?: {
    options: string[];
    branches: ((builder: EventBuilder) => void)[];
  }
): MZ_EventCommand[] {
  const builder = new EventBuilder();

  for (const line of dialogueLines) {
    builder.showText(line.face, line.faceIndex, line.text, line.speaker);
  }

  if (choices) {
    builder.showChoices(choices.options);
    for (let i = 0; i < choices.branches.length; i++) {
      builder.whenChoice(i, choices.branches[i]);
    }
  }

  return builder.end().build();
}

/**
 * Build a transfer event (e.g., door, exit point).
 */
export function buildTransferEvent(
  mapId: number,
  x: number,
  y: number,
  direction: number = 0,
  fadeType: number = 0
): MZ_EventCommand[] {
  return new EventBuilder()
    .transferPlayer(mapId, x, y, direction, fadeType)
    .end()
    .build();
}

/**
 * Build an auto-run cutscene event that plays once (using self-switch A).
 */
export function buildAutorunCutscene(
  buildContent: (builder: EventBuilder) => void
): MZ_EventCommand[] {
  const builder = new EventBuilder();
  buildContent(builder);
  builder.setSelfSwitch("A", true);
  return builder.end().build();
}

/**
 * Helper to create an audio file object.
 */
export function audioFile(
  name: string,
  volume: number = 90,
  pitch: number = 100,
  pan: number = 0
): MZ_AudioFile {
  return { name, volume, pitch, pan };
}
