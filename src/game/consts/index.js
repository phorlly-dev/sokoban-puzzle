const INSTANCES = {
    GAME: {
        WIDTH: 400,
        HEIGHT: 400,
    },
    TILES: {
        WALL: 100,
        FLOOR: 0,
        PLAYER: 52,
    },
    COLORS: {
        ORANGE: { BOX: 1, TARGET: 40 },
        RED: { BOX: 2, TARGET: 41 },
        BLUE: { BOX: 3, TARGET: 42 },
        GREEN: { BOX: 4, TARGET: 43 },
        GRAY: { BOX: 5, TARGET: 44 },
    },
    IDLE_ANIM: {
        left: "idle-left",
        right: "idle-right",
        up: "idle-up",
        down: "idle-down",
    },
};

export const { GAME, TILES, COLORS, IDLE_ANIM } = INSTANCES;
export const { WIDTH, HEIGHT } = GAME;
export const { WALL, FLOOR, PLAYER } = TILES;
export const { ORANGE, RED, BLUE, GREEN, GRAY } = COLORS;
