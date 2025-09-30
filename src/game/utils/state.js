import { applySnapshotAnimated } from "./payload";

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
    undoLastMove(scene) {
        if (scene.isMoving) return;
        const snap = scene.history.pop();
        if (!snap) return; // nothing to undo
        applySnapshotAnimated(scene, snap, 140); // match your STEP_MS feel
    },
    isCursorHeld(k) {
        return !!k && k.isDown;
    },
    toIdle(scene) {
        if (!scene.player) return;

        // fully stop current anim then show idle frame
        scene.player.anims.stop();
        scene.player.setFrame(52);
        stopIfPlaying(scene.walk);
    },
    isBlocked(scene, col, row) {
        if (!inBounds(scene, col, row)) return true;

        return scene.isWallAt(col, row);
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
    key(col, row) {
        return `${col},${row}`;
    },
    inBounds(scene, col, row) {
        return col >= 0 && col < scene.cols && row >= 0 && row < scene.rows;
    },
    inB(grid, c, r) {
        return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
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
    worldToGrid(scene, x, y) {
        return {
            col: Math.floor((x - scene.offsetX) / scene.tileSize),
            row: Math.floor((y - scene.offsetY) / scene.tileSize),
        };
    },
    clearButtons(scene) {
        scene.isLeft = scene.isRight = scene.isUp = scene.isDown = false;
    },
    safeDestroy(x) {
        if (!x) return;
        if (Array.isArray(x)) {
            x.forEach(safeDestroy);
            return;
        }
        if (typeof x.destroy === "function") x.destroy(true);
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
};

export const {
    snapshot,
    pushHistory,
    undoLastMove,
    isCursorHeld,
    toIdle,
    isBlocked,
    makeAnims,
    markForbiddenCells,
    key,
    inBounds,
    gridToWorld,
    snapToGrid,
    worldToGrid,
    clearButtons,
    safeDestroy,
    isSolid,
    isTarget,
    isCorner,
    shuffleInPlace,
    isBox,
    inB,
    randomWall,
    playIfNotPlaying,
    stopIfPlaying,
} = States;
