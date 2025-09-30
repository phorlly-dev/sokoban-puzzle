import { emitEvent } from "../../hooks/EventBus";
import { FLOOR, PLAYER } from "../consts";
import {
    addWallsWithPlayability,
    buildLevel,
    creates2x2BoxBlock,
    createsBoxPairWallTrap,
    isAnyDirectionActive,
    isBoxStartDeadlocked,
    playLevelCompleteFX,
} from "./payload";
import {
    gridToWorld,
    isBlocked,
    key,
    markForbiddenCells,
    playIfNotPlaying,
    pushHistory,
    safeDestroy,
    shuffleInPlace,
    toIdle,
} from "./state";

const Controllers = {
    destroyLevelGraphics(scene) {
        // sprites
        safeDestroy(scene.player);
        safeDestroy(scene.boxes);
        safeDestroy(scene.targets);

        scene.player = null;
        scene.boxes = [];
        scene.targets = [];
        scene.boxByKey?.clear?.();
        scene.targetKeys?.clear?.();

        // temp entity tilemap/layer
        safeDestroy(scene.entLayer);
        safeDestroy(scene.entMap);
        scene.entLayer = null;
        scene.entMap = null;

        // wall tilemap/layer (if present)
        safeDestroy(scene.wallLayer);
        safeDestroy(scene.wallMap);
        scene.wallLayer = null;
        scene.wallMap = null;

        // floor tilemap/layer
        safeDestroy(scene.floorLayer);
        safeDestroy(scene.floorMap);
        scene.floorLayer = null;
        scene.floorMap = null;

        // debug grid
        safeDestroy(scene.gridGraphics);
        scene.gridGraphics = null;
    },
    tryMove(scene, { x, y, animKey }) {
        if (scene.isMoving) return;

        const nextC = scene.playerGrid.col + x;
        const nextR = scene.playerGrid.row + y;
        if (isBlocked(scene, nextC, nextR)) return;

        pushHistory(scene);

        // check for a box in the next cell
        const box = scene.boxAt(nextC, nextR);
        let nbC, nbR, boxNextKey;
        if (box) {
            nbC = nextC + x;
            nbR = nextR + y;
            if (isBlocked(scene, nbC, nbR) || scene.boxAt(nbC, nbR)) return;
            boxNextKey = key(nbC, nbR);
        }

        scene.isMoving = true;

        // update grid state immediately; tweens will visually catch up
        const prevKey = key(nextC, nextR);
        scene.playerGrid = { col: nextC, row: nextR };
        if (box) {
            scene.boxByKey.delete(prevKey);
            scene.boxByKey.set(boxNextKey, box);
        }

        const STEP_MS = 460;

        // tween targets are absolute world coordinates
        const playerWorld = gridToWorld(scene, nextC, nextR);

        let waits = 1 + (box ? 1 : 0);
        const finish = () => {
            if (--waits === 0) {
                scene.isMoving = false;

                // stop anim only if no direction is currently held
                if (!isAnyDirectionActive(scene)) toIdle(scene);
                checkWin(scene);
            }
        };

        // player step
        scene.tweens.add({
            targets: scene.player,
            x: playerWorld.x,
            y: playerWorld.y,
            duration: STEP_MS,
            ease: "Linear",
            onStart: () => {
                if (animKey) {
                    scene.player.anims.play(animKey, true);
                    playIfNotPlaying(scene.walk);
                }
            },
            onComplete: finish,
        });

        // box step (if pushing)
        if (box) {
            const boxWorld = gridToWorld(scene, nbC, nbR);
            scene.tweens.add({
                targets: box,
                x: boxWorld.x,
                y: boxWorld.y,
                duration: STEP_MS,
                ease: "Linear",
                onComplete: finish,
            });
        }
    },
    checkWin(scene) {
        for (const key of scene.targetKeys) {
            if (!scene.boxByKey.has(key)) return;
        }
        if (scene.hasWon) return;
        scene.hasWon = true;

        const { width, height } = scene.game.config;
        const winText = scene.add
            .text(width / 2, height / 2, `Level ${scene.level} Complete!`, {
                fontSize: "32px",
                fontStyle: "bold",
                color: "#00ff00",
                stroke: "#003300",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(10);

        // play effects 🎉
        playLevelCompleteFX(scene, winText);

        scene.score += scene.boxLength * 100;
        emitEvent("score", scene.score);

        // Example: progress and rebuild the next level after a short pause
        scene.time.delayedCall(1600, () => {
            winText.destroy();
            scene.level += 1;
            scene.hasWon = false;

            scene.scene.restart({
                score: scene.score,
                level: scene.level,
                has_won: scene.hasWon,
            });
            buildLevel(scene);
        });
    },
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
    drawDashedGrid(
        scene,
        { rows, cols, tileSize, offsetX = 0, offsetY = 0, dash = 6, gap = 4 }
    ) {
        if (scene.gridGraphics) scene.gridGraphics.destroy();
        const g = (scene.gridGraphics = scene.add.graphics());
        g.lineStyle(1, 0xff0000, 0.35);

        const width = cols * tileSize;
        const height = rows * tileSize;

        for (let c = 0; c <= cols; c++) {
            const x = offsetX + c * tileSize;
            for (let y = 0; y < height; y += dash + gap) {
                g.beginPath();
                g.moveTo(x, offsetY + y);
                g.lineTo(x, offsetY + Math.min(y + dash, height));
                g.strokePath();
            }
        }
        for (let r = 0; r <= rows; r++) {
            const y = offsetY + r * tileSize;
            for (let x = 0; x < width; x += dash + gap) {
                g.beginPath();
                g.moveTo(offsetX + x, y);
                g.lineTo(offsetX + Math.min(x + dash, width), y);
                g.strokePath();
            }
        }
        g.setDepth(5);

        return g;
    },
    placeBoxesAvoidingDeadlocks(
        scene,
        grid,
        boxCount,
        pair,
        targetKeys,
        { avoidBorder = 1 } = {}
    ) {
        const rows = grid.length,
            cols = grid[0].length;
        const inInterior = (c, r) =>
            c >= avoidBorder &&
            c < cols - avoidBorder &&
            r >= avoidBorder &&
            r < rows - avoidBorder;

        const candidates = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!inInterior(c, r)) continue; // keep off borders
                if (grid[r][c] !== FLOOR) continue; // free only
                if (targetKeys.has(`${c},${r}`)) continue; // don’t start on targets
                if (isBoxStartDeadlocked(scene, grid, targetKeys, c, r))
                    continue; // your existing filter
                // NEW: reject if it would create a pair-against-wall with an existing box
                if (createsBoxPairWallTrap(scene, grid, c, r, pair.BOX))
                    continue;
                // NEW: reject if it would form a 2×2 block of boxes
                if (creates2x2BoxBlock(grid, c, r, pair.BOX)) continue;

                candidates.push({ c, r });
            }
        }

        shuffleInPlace(candidates);

        let placed = 0;
        for (const { c, r } of candidates) {
            // final safety before committing (grid mutates after this)
            if (createsBoxPairWallTrap(scene, grid, c, r, pair.BOX)) continue;
            if (creates2x2BoxBlock(scene, grid, c, r, pair.BOX)) continue;

            grid[r][c] = pair.BOX;
            placed++;
            if (placed >= boxCount) break;
        }

        return placed;
    },
};

export const {
    destroyLevelGraphics,
    tryMove,
    checkWin,
    generateRandomLevel,
    drawDashedGrid,
    placeBoxesAvoidingDeadlocks,
} = Controllers;
