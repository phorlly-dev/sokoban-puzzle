import { emitEvent } from "../../hooks/EventBus";
import { FLOOR } from "../consts";
import {
    gridToWorld,
    isAnyDirectionActive,
    isBlocked,
    key,
    playIfNotPlaying,
    safeDestroy,
} from "./helper";
import { creates2x2BoxBlock, createsBoxPairWallTrap } from "./object";
import {
    applySnapshotAnimated,
    buildLevel,
    isBoxStartDeadlocked,
    playLevelCompleteFX,
} from "./payload";
import { pushHistory, shuffleInPlace, toIdle } from "./state";

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
                color: "#0fce0fff",
                stroke: "#003300",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(10);

        scene.sound.play("win");
        const points = scene.boxLength * 100;

        // play effects 🎉
        playLevelCompleteFX(scene, winText, points);

        scene.score += points;
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
    undoLastMove(scene) {
        if (scene.isMoving) return;
        const snap = scene.history.pop();
        if (!snap) return; // nothing to undo
        applySnapshotAnimated(scene, snap, 140); // match your STEP_MS feel
    },
};

export const {
    destroyLevelGraphics,
    tryMove,
    checkWin,
    placeBoxesAvoidingDeadlocks,
    undoLastMove,
} = Controllers;
