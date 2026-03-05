// RPG Maker MZ Event Command Codes
// Extracted from rmmz_objects.js Game_Interpreter

export const CMD = {
  END: 0,

  // Message
  SHOW_TEXT: 101,
  SHOW_TEXT_LINE: 401,
  SHOW_CHOICES: 102,
  WHEN_CHOICE: 402,
  WHEN_CANCEL: 403,
  INPUT_NUMBER: 103,
  SELECT_ITEM: 104,
  SHOW_SCROLLING_TEXT: 105,
  SHOW_SCROLLING_TEXT_LINE: 405,
  COMMENT: 108,
  COMMENT_LINE: 408,

  // Flow Control
  CONDITIONAL_BRANCH: 111,
  ELSE: 411,
  LOOP: 112,
  REPEAT_ABOVE: 413,
  BREAK_LOOP: 113,
  EXIT_EVENT: 115,
  COMMON_EVENT: 117,
  LABEL: 118,
  JUMP_TO_LABEL: 119,

  // Game Switches / Variables
  CONTROL_SWITCHES: 121,
  CONTROL_VARIABLES: 122,
  CONTROL_SELF_SWITCH: 123,
  CONTROL_TIMER: 124,

  // Gold / Items
  CHANGE_GOLD: 125,
  CHANGE_ITEMS: 126,
  CHANGE_WEAPONS: 127,
  CHANGE_ARMORS: 128,
  CHANGE_PARTY_MEMBER: 129,

  // System
  CHANGE_BATTLE_BGM: 132,
  CHANGE_VICTORY_ME: 133,
  CHANGE_SAVE_ACCESS: 134,
  CHANGE_MENU_ACCESS: 135,
  CHANGE_ENCOUNTER: 136,
  CHANGE_FORMATION_ACCESS: 137,
  CHANGE_WINDOW_COLOR: 138,
  CHANGE_DEFEAT_ME: 139,
  CHANGE_VEHICLE_BGM: 140,

  // Transfer / Movement
  TRANSFER_PLAYER: 201,
  SET_VEHICLE_LOCATION: 202,
  SET_EVENT_LOCATION: 203,
  SCROLL_MAP: 204,
  SET_MOVEMENT_ROUTE: 205,
  GET_ON_OFF_VEHICLE: 206,

  // Character
  CHANGE_TRANSPARENCY: 211,
  SHOW_ANIMATION: 212,
  SHOW_BALLOON_ICON: 213,
  ERASE_EVENT: 214,
  CHANGE_FOLLOWER_VISIBILITY: 216,
  GATHER_FOLLOWERS: 217,

  // Screen
  FADEOUT_SCREEN: 221,
  FADEIN_SCREEN: 222,
  TINT_SCREEN: 223,
  FLASH_SCREEN: 224,
  SHAKE_SCREEN: 225,
  WAIT: 230,

  // Picture
  SHOW_PICTURE: 231,
  MOVE_PICTURE: 232,
  ROTATE_PICTURE: 233,
  TINT_PICTURE: 234,
  ERASE_PICTURE: 235,

  // Weather
  SET_WEATHER_EFFECT: 236,

  // Audio
  PLAY_BGM: 241,
  FADEOUT_BGM: 242,
  SAVE_BGM: 243,
  RESUME_BGM: 244,
  PLAY_BGS: 245,
  FADEOUT_BGS: 246,
  PLAY_ME: 249,
  PLAY_SE: 250,
  STOP_SE: 251,

  // Movie
  PLAY_MOVIE: 261,

  // Map
  CHANGE_MAP_NAME_DISPLAY: 281,
  CHANGE_TILESET: 282,
  CHANGE_BATTLE_BACKGROUND: 283,
  CHANGE_PARALLAX: 284,
  GET_LOCATION_INFO: 285,

  // Battle
  BATTLE_PROCESSING: 301,
  IF_WIN: 601,
  IF_ESCAPE: 602,
  IF_LOSE: 603,
  SHOP_PROCESSING: 302,
  SHOP_ITEM: 605,
  NAME_INPUT: 303,

  // Actor
  CHANGE_HP: 311,
  CHANGE_MP: 312,
  CHANGE_TP: 326,
  CHANGE_STATE: 313,
  RECOVER_ALL: 314,
  CHANGE_EXP: 315,
  CHANGE_LEVEL: 316,
  CHANGE_PARAMETER: 317,
  CHANGE_SKILL: 318,
  CHANGE_EQUIPMENT: 319,
  CHANGE_NAME: 320,
  CHANGE_CLASS: 321,
  CHANGE_ACTOR_IMAGES: 322,
  CHANGE_VEHICLE_IMAGE: 323,
  CHANGE_NICKNAME: 324,
  CHANGE_PROFILE: 325,

  // Enemy (Battle)
  CHANGE_ENEMY_HP: 331,
  CHANGE_ENEMY_MP: 332,
  CHANGE_ENEMY_TP: 342,
  CHANGE_ENEMY_STATE: 333,
  ENEMY_RECOVER_ALL: 334,
  ENEMY_APPEAR: 335,
  ENEMY_TRANSFORM: 336,
  SHOW_BATTLE_ANIMATION: 337,
  FORCE_ACTION: 339,
  ABORT_BATTLE: 340,

  // Scene
  OPEN_MENU: 351,
  OPEN_SAVE: 352,
  GAME_OVER: 353,
  RETURN_TO_TITLE: 354,
  SCRIPT: 355,
  SCRIPT_LINE: 655,
  PLUGIN_COMMAND_MV: 356,
  PLUGIN_COMMAND: 357,
} as const;

// Event trigger types
export const TRIGGER = {
  ACTION_BUTTON: 0,
  PLAYER_TOUCH: 1,
  EVENT_TOUCH: 2,
  AUTORUN: 3,
  PARALLEL: 4,
} as const;

// Character directions
export const DIR = {
  DOWN: 2,
  LEFT: 4,
  RIGHT: 6,
  UP: 8,
} as const;

// Event priority types
export const PRIORITY = {
  BELOW_CHARACTERS: 0,
  SAME_AS_CHARACTERS: 1,
  ABOVE_CHARACTERS: 2,
} as const;

// Move route commands
export const ROUTE = {
  END: 0,
  MOVE_DOWN: 1,
  MOVE_LEFT: 2,
  MOVE_RIGHT: 3,
  MOVE_UP: 4,
  MOVE_RANDOM: 9,
  MOVE_TOWARD: 10,
  MOVE_AWAY: 11,
  MOVE_FORWARD: 12,
  TURN_DOWN: 16,
  TURN_LEFT: 17,
  TURN_RIGHT: 18,
  TURN_UP: 19,
  TURN_RANDOM: 24,
  TURN_TOWARD: 25,
  TURN_AWAY: 26,
  SWITCH_ON: 27,
  SWITCH_OFF: 28,
  CHANGE_SPEED: 29,
  CHANGE_FREQ: 30,
  WALK_ANIME_ON: 31,
  WALK_ANIME_OFF: 32,
  STEP_ANIME_ON: 33,
  STEP_ANIME_OFF: 34,
  DIR_FIX_ON: 35,
  DIR_FIX_OFF: 36,
  THROUGH_ON: 37,
  THROUGH_OFF: 38,
  TRANSPARENT_ON: 39,
  TRANSPARENT_OFF: 40,
  CHANGE_IMAGE: 41,
  CHANGE_OPACITY: 42,
  CHANGE_BLEND_MODE: 43,
  PLAY_SE: 44,
  SCRIPT: 45,
} as const;

// Balloon icon IDs
export const BALLOON = {
  EXCLAMATION: 1,
  QUESTION: 2,
  MUSIC_NOTE: 3,
  HEART: 4,
  ANGER: 5,
  SWEAT: 6,
  COBWEB: 7,
  SILENCE: 8,
  LIGHT_BULB: 9,
  ZZZ: 10,
  USER1: 11,
  USER2: 12,
  USER3: 13,
  USER4: 14,
  USER5: 15,
} as const;

// Default empty conditions for event pages
export function defaultConditions(): {
  actorId: number;
  actorValid: boolean;
  itemId: number;
  itemValid: boolean;
  selfSwitchCh: string;
  selfSwitchValid: boolean;
  switch1Id: number;
  switch1Valid: boolean;
  switch2Id: number;
  switch2Valid: boolean;
  variableId: number;
  variableValid: boolean;
  variableValue: number;
} {
  return {
    actorId: 1,
    actorValid: false,
    itemId: 1,
    itemValid: false,
    selfSwitchCh: "A",
    selfSwitchValid: false,
    switch1Id: 1,
    switch1Valid: false,
    switch2Id: 1,
    switch2Valid: false,
    variableId: 1,
    variableValid: false,
    variableValue: 0,
  };
}

// Default empty move route
export function defaultMoveRoute() {
  return {
    list: [{ code: ROUTE.END, parameters: [] }],
    repeat: true,
    skippable: false,
    wait: false,
  };
}
