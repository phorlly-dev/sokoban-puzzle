import { FLOOR, PLAYER } from "../consts";
import { placeBoxesAvoidingDeadlocks } from "./controller";
import { addWallsWithPlayability } from "./payload";
import { shuffleInPlace } from "./state";

const Helpers = {
    generateRandomLevel(
        scene,
        { rows, cols, boxCount = 1, pair = scene.currentPair, level = 1 }
    ) {
        markForbiddenCells(scene, rows, cols);

        // base grid
        const grid = Array.from({ length: rows }, () =>
            Array(cols).fill(FLOOR)
        );

        // usable cells (skip forbidden)
        const cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!scene.forbiddenCells.has(key(c, r))) cells.push({ r, c });
            }
        }
        shuffleInPlace(cells);

        // --- player ---
        const p = cells.pop();
        grid[p.r][p.c] = PLAYER;
        const playerPos = { col: p.c, row: p.r };

        // --- targets first (so walls respect them and box filter can see them) ---
        const targetKeys = new Set();
        for (let i = 0; i < boxCount; i++) {
            const t = cells.pop();
            if (!t) break;
            grid[t.r][t.c] = pair.TARGET;
            targetKeys.add(key(t.c, t.r));
        }

        // --- walls (connectivity-safe) ---
        addWallsWithPlayability(scene, grid, playerPos, level, {
            startLevel: 3,
            minDistFromPlayer: 1,
            protectTargets: true,
            targetKeys, // Set of "c,r" strings for your targets
        });

        // --- boxes avoiding deadlocks (after walls are final) ---
        let placed = placeBoxesAvoidingDeadlocks(
            scene,
            grid,
            boxCount,
            pair,
            targetKeys,
            { avoidBorder: 1 } // 1-cell margin; use 2 for a thicker safety ring
        );

        // optional retry if you want to guarantee count
        if (placed < boxCount) {
            placed += placeBoxesAvoidingDeadlocks(
                scene,
                grid,
                boxCount - placed,
                pair,
                targetKeys,
                { avoidBorder: 2 }
            );
        }

        return grid;
    },
    gridToWorld(scene, col, row) {
        const x = scene.offsetX + col * scene.tileSize + scene.tileSize / 2;
        const y = scene.offsetY + row * scene.tileSize + scene.tileSize / 2;

        // snap to integers to avoid subpixel “swim”
        return { x: Math.round(x), y: Math.round(y) };
    },
    snapToGrid(scene, sprite) {
        const g = worldToGrid(scene, sprite.x, sprite.y);
        const w = gridToWorld(scene, g.col, g.row); // rounds with Math.round
        sprite.setPosition(w.x, w.y);

        return g;
    },
    markForbiddenCells(scene, rows, cols) {
        scene.forbiddenCells.clear();

        // Forbid border cells so stuff doesn't spawn there
        for (let c = 0; c < cols; c++) {
            scene.forbiddenCells.add(key(c, 0));
            scene.forbiddenCells.add(key(c, rows - 1));
        }

        for (let r = 0; r < rows; r++) {
            scene.forbiddenCells.add(key(0, r));
            scene.forbiddenCells.add(key(cols - 1, r));
        }
    },
    makeAnims(scene, texture, defs) {
        defs.forEach(({ key, start, end }) => {
            if (scene.anims.exists(key)) return;
            scene.anims.create({
                key,
                frames: scene.anims.generateFrameNumbers(texture, {
                    start,
                    end,
                }),
                frameRate: 10,
                repeat: -1,
            });
        });
    },
    key(col, row) {
        return `${col},${row}`;
    },
    isCursorHeld(k) {
        return !!k && k.isDown;
    },
    isBlocked(scene, col, row) {
        if (!inBounds(scene, col, row)) return true;

        return scene.isWallAt(col, row);
    },
    inBounds(scene, col, row) {
        return col >= 0 && col < scene.cols && row >= 0 && row < scene.rows;
    },
    inB(grid, c, r) {
        return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
    },
    worldToGrid(scene, x, y) {
        return {
            col: Math.floor((x - scene.offsetX) / scene.tileSize),
            row: Math.floor((y - scene.offsetY) / scene.tileSize),
        };
    },
    safeDestroy(x) {
        if (!x) return;
        if (Array.isArray(x)) {
            x.forEach(safeDestroy);
            return;
        }
        if (typeof x.destroy === "function") x.destroy(true);
    },
    isAnyDirectionActive(scene) {
        const c = scene.cursors || {};
        return (
            scene.isLeft ||
            scene.isRight ||
            scene.isUp ||
            scene.isDown ||
            isCursorHeld(c.left) ||
            isCursorHeld(c.right) ||
            isCursorHeld(c.up) ||
            isCursorHeld(c.down)
        );
    },
    playIfNotPlaying(sound) {
        if (sound && !sound.isPlaying) {
            sound.play();
        }
    },
    stopIfPlaying(sound) {
        if (sound && sound.isPlaying) {
            sound.stop();
        }
    },
    getRandom(args) {
        return Phaser.Utils.Array.GetRandom(args);
    },
};

export const {
    generateRandomLevel,
    gridToWorld,
    snapToGrid,
    markForbiddenCells,
    makeAnims,
    key,
    isCursorHeld,
    isBlocked,
    inBounds,
    inB,
    worldToGrid,
    safeDestroy,
    isAnyDirectionActive,
    playIfNotPlaying,
    stopIfPlaying,
    getRandom,
} = Helpers;
