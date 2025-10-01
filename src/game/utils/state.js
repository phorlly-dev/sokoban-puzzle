import { PLAYER } from "../consts";
import { stopIfPlaying, worldToGrid } from "./helper";

const States = {
    snapshot(scene) {
        return {
            score: scene.score,
            level: scene.level,
            player: { ...scene.playerGrid },
            boxes: scene.boxes.map((b) => {
                const g = worldToGrid(scene, b.x, b.y);

                return { ref: b, col: g.col, row: g.row };
            }),
        };
    },
    pushHistory(scene) {
        scene.history.push(snapshot(scene));
        if (scene.history.length > scene.maxHistory) scene.history.shift();
    },
    toIdle(scene) {
        if (!scene.player) return;

        // fully stop current anim then show idle frame
        scene.player.anims.stop();
        stopIfPlaying(scene.walk);
        scene.time.delayedCall(360, () => scene.player.setFrame(PLAYER));
    },
    clearButtons(scene) {
        scene.isLeft = scene.isRight = scene.isUp = scene.isDown = false;
    },
    isSolid(scene, grid, c, r) {
        const rows = grid.length,
            cols = grid[0].length;
        if (c < 0 || c >= cols || r < 0 || r >= rows) return true;

        return scene.isWallAt(c, r);
    },
    isBox(grid, c, r, boxId) {
        return grid[r]?.[c] === boxId; // current-level box id
    },
    isTarget(targetKeys, c, r) {
        return targetKeys.has(`${c},${r}`);
    },
    isCorner(scene, grid, c, r) {
        const a =
            isSolid(scene, grid, c - 1, r) && isSolid(scene, grid, c, r - 1);
        const b =
            isSolid(scene, grid, c + 1, r) && isSolid(scene, grid, c, r - 1);
        const c1 =
            isSolid(scene, grid, c - 1, r) && isSolid(scene, grid, c, r + 1);
        const d =
            isSolid(scene, grid, c + 1, r) && isSolid(scene, grid, c, r + 1);

        return a || b || c1 || d;
    },
    shuffleInPlace(args) {
        for (let i = args.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [args[i], args[j]] = [args[j], args[i]];
        }

        return args;
    },
    randomWall(scene) {
        return scene.wallFrames[(Math.random() * scene.wallFrames.length) | 0];
    },
};

export const {
    snapshot,
    pushHistory,
    toIdle,
    clearButtons,
    isSolid,
    isTarget,
    isCorner,
    shuffleInPlace,
    isBox,
    randomWall,
} = States;
