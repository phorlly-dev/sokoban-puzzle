import { COLORS, FLOOR, PLAYER } from "../consts";
import {
    destroyLevelGraphics,
    drawDashedGrid,
    generateRandomLevel,
} from "./controller";
import {
    gridToWorld,
    inB,
    isBox,
    isCorner,
    isCursorHeld,
    isSolid,
    isTarget,
    key,
    makeAnims,
    randomWall,
    snapToGrid,
    toIdle,
} from "./state";

const Payloads = {
    buildLevel(scene) {
        scene.history = [];

        // clear prior level (if any)
        destroyLevelGraphics(scene);

        // choose one color pair for scene level
        scene.currentPair = Phaser.Utils.Array.GetRandom(Object.values(COLORS));

        // generate grid data (make sure your generator can place WALLs)
        scene.data = generateRandomLevel(scene, {
            rows: 6,
            cols: 6,
            boxCount: 3,
            pair: scene.currentPair,
            level: scene.level,
        });

        scene.rows = scene.data.length;
        scene.cols = scene.data[0].length;

        // center offsets
        const { x, y } = centerBoardOffset(scene, {
            rows: scene.rows,
            cols: scene.cols,
            tileSize: scene.tileSize,
        });
        scene.offsetX = x;
        scene.offsetY = y;

        // dashed grid (debug)
        if (scene.gridVisible) {
            drawDashedGrid(scene, {
                rows: scene.rows,
                cols: scene.cols,
                tileSize: scene.tileSize,
                offsetX: scene.offsetX,
                offsetY: scene.offsetY,
            });
        }

        // --- FLOOR layer (kept)
        const floorData = Array.from({ length: scene.rows }, () =>
            Array(scene.cols).fill(FLOOR)
        );
        scene.floorMap = scene.make.tilemap({
            data: floorData,
            tileWidth: scene.tileSize,
            tileHeight: scene.tileSize,
        });
        const tileset = scene.floorMap.addTilesetImage(
            "tiles",
            null,
            scene.tileSize,
            scene.tileSize
        );
        scene.floorLayer = scene.floorMap
            .createLayer(0, tileset, scene.offsetX, scene.offsetY)
            .setDepth(0);

        // --- WALL layer (NEW: kept)
        const wallData = scene.data.map((row) =>
            row.map((v) => (scene.isWallVal(v) ? v : -1))
        );
        scene.wallMap = scene.make.tilemap({
            data: wallData,
            tileWidth: scene.tileSize,
            tileHeight: scene.tileSize,
        });
        const wallTileset = scene.wallMap.addTilesetImage(
            "tiles",
            null,
            scene.tileSize,
            scene.tileSize
        );
        scene.wallLayer = scene.wallMap
            .createLayer(0, wallTileset, scene.offsetX, scene.offsetY)
            .setDepth(1);

        // --- ENTITY temp layer (PLAYER/BOX/TARGET only; WALLS excluded)
        const entitiesData = scene.data.map((row) =>
            row.map((v) => (v === FLOOR || scene.isWallVal(v) ? -1 : v))
        );
        scene.entMap = scene.make.tilemap({
            data: entitiesData,
            tileWidth: scene.tileSize,
            tileHeight: scene.tileSize,
        });
        const entTileset = scene.entMap.addTilesetImage(
            "tiles",
            null,
            scene.tileSize,
            scene.tileSize
        );
        scene.entLayer = scene.entMap
            .createLayer(0, entTileset, scene.offsetX, scene.offsetY)
            .setDepth(1.1);

        // extract sprites
        const playerSprites = scene.entLayer.createFromTiles(PLAYER, -1, {
            key: "tiles",
            frame: PLAYER,
        });
        scene.player =
            playerSprites.pop() || scene.add.sprite(0, 0, "tiles", PLAYER);
        scene.player.setOrigin(0.5).setDepth(3);
        scene.playerGrid = snapToGrid(scene, scene.player);

        const { BOX, TARGET } = scene.currentPair;

        // boxes
        scene.boxes = scene.entLayer.createFromTiles(BOX, -1, {
            key: "tiles",
            frame: BOX,
        });
        scene.boxByKey.clear();
        for (const b of scene.boxes) {
            b.setOrigin(0.5).setDepth(2);
            const g = snapToGrid(scene, b);
            scene.boxByKey.set(key(g.col, g.row), b);
        }

        // targets (behind boxes)
        scene.targets = scene.entLayer.createFromTiles(TARGET, -1, {
            key: "tiles",
            frame: TARGET,
        });
        scene.targetKeys.clear();
        for (const t of scene.targets) {
            t.setOrigin(0.5).setDepth(1.15);
            const g = snapToGrid(scene, t);
            scene.targetKeys.add(key(g.col, g.row));
        }

        // temp entity layer no longer needed
        scene.entLayer.destroy();
        scene.entLayer = null;

        // camera bounds (around centered board)
        scene.cameras.main.setBounds(
            0,
            0,
            scene.cols * scene.tileSize + scene.offsetX * 2,
            scene.rows * scene.tileSize + scene.offsetY * 2
        );
    },
    applySnapshotAnimated(scene, snap, stepMs = 140) {
        // lock input while rolling back
        scene.isMoving = true;

        // player target position
        const pw = gridToWorld(scene, snap.player.col, snap.player.row);

        let waits = 1 + snap.boxes.length;
        const finish = () => {
            if (--waits === 0) {
                // rebuildLevel boxByKey map after all are in their grid cells
                scene.boxByKey.clear();
                for (const { ref, col, row } of snap.boxes) {
                    scene.boxByKey.set(key(col, row), ref);
                }
                scene.playerGrid = { ...snap.player };
                scene.score = snap.score;

                scene.isMoving = false;
                scene.hasWon = false; // prevent being stuck in win state if you undo right after win text
                scene.toIdle && toIdle(scene);
            }
        };

        // player
        scene.tweens.add({
            targets: scene.player,
            x: pw.x,
            y: pw.y,
            duration: stepMs,
            ease: "Linear",
            onComplete: finish,
        });

        // boxes
        for (const { ref, col, row } of snap.boxes) {
            const bw = gridToWorld(scene, col, row);
            scene.tweens.add({
                targets: ref,
                x: bw.x,
                y: bw.y,
                duration: stepMs,
                ease: "Linear",
                onComplete: finish,
            });
        }
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
    playLevelCompleteFX(scene, winText) {
        const cam = scene.cameras.main;

        // 1) Screen flash + tiny shake
        cam.flash(200, 255, 255, 255);
        cam.shake(120, 0.004);

        // 2) Confetti bursts on each target cell
        const bursts = [];
        for (const key of scene.targetKeys) {
            const [c, r] = key.split(",").map((n) => +n);
            const { x, y } = gridToWorld(scene, c, r);
            const emitter = scene.add.particles(0, 0, "fx-dot", {
                x,
                y,
                lifespan: { min: 300, max: 700 },
                speed: { min: 120, max: 240 },
                angle: { min: 0, max: 360 },
                scale: { start: 1, end: 0 },
                quantity: 0, // manual burst
                blendMode: "ADD",
            });
            emitter.explode(14, x, y);
            bursts.push(emitter);
            // auto-destroy after a moment
            scene.time.delayedCall(800, () => emitter.destroy());
        }

        // 3) Bounce + fade of the "Level Complete!" text
        if (winText) {
            winText.setScale(0.8).setAlpha(0);
            scene.tweens.add({
                targets: winText,
                alpha: 1,
                duration: 160,
                ease: "Quad.Out",
            });
            scene.tweens.add({
                targets: winText,
                scale: { from: 0.8, to: 1.15 },
                y: winText.y - 12,
                yoyo: true,
                duration: 260,
                repeat: 2,
                ease: "Back.Out",
            });
            scene.tweens.add({
                delay: 420,
                targets: winText,
                alpha: 0,
                duration: 260,
                ease: "Quad.In",
            });
        }

        // 4) Quick score pop feedback (if you update score here)
        const scoreBump = scene.add
            .text(
                winText ? winText.x : scene.scale.width / 2,
                (winText ? winText.y : scene.scale.height / 2) + 40,
                "+100",
                { fontSize: "24px", fontStyle: "bold", color: "#00ff00" }
            )
            .setOrigin(0.5)
            .setDepth(11)
            .setAlpha(0);

        scene.tweens.add({
            targets: scoreBump,
            alpha: 1,
            y: scoreBump.y - 22,
            duration: 240,
            ease: "Quad.Out",
            yoyo: true,
            hold: 120,
            onComplete: () => scoreBump.destroy(),
        });

        // Optional: play a win sound if you have one
        if (scene.sound && scene.sound.get("win")) scene.sound.play("win");
    },
    createAnimations(scene) {
        makeAnims(scene, "tiles", [
            { key: "left", start: 81, end: 83 },
            { key: "right", start: 78, end: 80 },
            { key: "up", start: 55, end: 57 },
            { key: "down", start: 52, end: 54 },
        ]);
    },
    addWallsWithPlayability(
        scene,
        grid,
        playerPos,
        level,
        {
            startLevel = 3,
            minDistFromPlayer = 1,
            protectTargets = true,
            targetKeys = new Set(),
        } = {}
    ) {
        if (level < startLevel) return;

        const rows = grid.length,
            cols = grid[0].length;

        // difficulty
        const bars = Phaser.Math.Clamp(Math.floor(level / 3) + 1, 1, 5);
        const lenMin = 2;
        const lenMax = Math.max(lenMin, Math.min(cols, rows) - 2);

        // ---- local helpers that read the *grid* (not scene.data) ----
        const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const isWallVal = (v) => scene.isWallVal(v);
        const isWallAt = (c, r) => inBounds(c, r) && isWallVal(grid[r][c]);
        const isFreeAt = (c, r) => inBounds(c, r) && !isWallVal(grid[r][c]);
        const isTarget = (c, r) => targetKeys.has(`${c},${r}`);

        const manhattan = (c, r, c2, r2) => Math.abs(c - c2) + Math.abs(r - r2);
        const nearPlayer = (c, r) =>
            manhattan(c, r, playerPos.col, playerPos.row) <= minDistFromPlayer;
        const nearTarget = (c, r) =>
            isTarget(c, r) ||
            isTarget(c + 1, r) ||
            isTarget(c - 1, r) ||
            isTarget(c, r + 1) ||
            isTarget(c, r - 1);

        // must have a 2-tile push lane into each target
        const hasAnyPushLane = (tc, tr) => {
            const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ];
            for (const [dx, dy] of dirs) {
                const n1c = tc + dx,
                    n1r = tr + dy;
                const n2c = tc + 2 * dx,
                    n2r = tr + 2 * dy;
                if (isFreeAt(n1c, n1r) && isFreeAt(n2c, n2r)) return true;
            }
            return false;
        };

        // temp bar joins an existing wall?
        const touchesExistingWall = (cells) => {
            const mask = new Set(cells.map(({ c, r }) => `${c},${r}`));
            const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ];

            for (const { c, r } of cells) {
                for (const [dx, dy] of dirs) {
                    const nc = c + dx,
                        nr = r + dy;
                    if (!inBounds(nc, nr)) continue;
                    if (isWallAt(nc, nr) && !mask.has(`${nc},${nr}`))
                        return true;
                }
            }
            return false;
        };

        // Measure continuous run length along (dx,dy) including (c,r)
        const measureRunLen = (c, r, dx, dy) => {
            let x = c,
                y = r;
            while (inBounds(x - dx, y - dy) && isWallAt(x - dx, y - dy)) {
                x -= dx;
                y -= dy;
            }
            let len = 0;
            while (inBounds(x, y) && isWallAt(x, y)) {
                len++;
                x += dx;
                y += dy;
            }
            return len;
        };

        // Would stamping exceed a maximum continuous run in the bar direction?
        const exceedsMaxRunAfterStamp = (cells, horiz, maxRun, barFrame) => {
            // temp stamp with a single frame
            for (const { c, r } of cells) grid[r][c] = barFrame;
            const [dx, dy] = horiz ? [1, 0] : [0, 1];
            let bad = false;
            for (const { c, r } of cells) {
                if (measureRunLen(c, r, dx, dy) > maxRun) {
                    bad = true;
                    break;
                }
            }
            // rollback
            for (const { c, r } of cells) grid[r][c] = FLOOR;
            return bad;
        };

        // No 1-tile corridors (except if the cell is a target AND still has a push lane)
        const createsOneTileCorridor = (cells, barFrame) => {
            for (const { c, r } of cells) grid[r][c] = barFrame; // temp stamp
            let bad = false;
            for (let r = 0; !bad && r < rows; r++) {
                for (let c = 0; !bad && c < cols; c++) {
                    if (isWallAt(c, r)) continue; // <-- FIX: skip any wall
                    const lr = isWallAt(c - 1, r) && isWallAt(c + 1, r);
                    const ud = isWallAt(c, r - 1) && isWallAt(c, r + 1);
                    if (lr || ud) {
                        if (!isTarget(c, r) || !hasAnyPushLane(c, r))
                            bad = true;
                    }
                }
            }
            for (const { c, r } of cells) grid[r][c] = FLOOR; // rollback
            return bad;
        };

        // reachability on non-wall tiles
        const bfsReachableCount = (startC, startR) => {
            if (!inBounds(startC, startR) || isWallAt(startC, startR)) return 0;
            const seen = new Set([`${startC},${startR}`]);
            const Q = [{ c: startC, r: startR }];
            while (Q.length) {
                const { c, r } = Q.shift();
                for (const [dx, dy] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ]) {
                    const nc = c + dx,
                        nr = r + dy;
                    if (!inBounds(nc, nr) || isWallAt(nc, nr)) continue;
                    const k = `${nc},${nr}`;
                    if (!seen.has(k)) {
                        seen.add(k);
                        Q.push({ c: nc, r: nr });
                    }
                }
            }
            return seen.size;
        };
        const countWalkable = () => {
            let n = 0;
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++) if (!isWallVal(grid[r][c])) n++;
            return n;
        };

        const tryStampBar = () => {
            const horiz = Phaser.Math.Between(0, 1) === 0;
            const L = Phaser.Math.Between(lenMin, lenMax);
            const c0 = Phaser.Math.Between(1, cols - 2);
            const r0 = Phaser.Math.Between(1, rows - 2);
            const barFrame = randomWall(scene); // one look per bar

            const cells = [];
            for (let i = 0; i < L; i++) {
                const c = horiz ? c0 + i : c0;
                const r = horiz ? r0 : r0 + i;
                if (c <= 0 || c >= cols - 1 || r <= 0 || r >= rows - 1) break;
                if (!isFreeAt(c, r)) return false;
                if (nearPlayer(c, r)) return false;
                if (protectTargets && nearTarget(c, r)) return false;
                cells.push({ c, r });
            }
            if (cells.length < 2) return false;

            // playability guards
            if (touchesExistingWall(cells)) return false;
            const MAX_RUN = 3;
            if (exceedsMaxRunAfterStamp(cells, horiz, MAX_RUN, barFrame))
                return false;
            if (createsOneTileCorridor(cells, barFrame)) return false;

            // tentative stamp
            for (const { c, r } of cells) grid[r][c] = barFrame;

            // connectivity
            const ok =
                bfsReachableCount(playerPos.col, playerPos.row) ===
                countWalkable();
            if (!ok) {
                for (const { c, r } of cells) grid[r][c] = FLOOR;
                return false;
            }
            return true;
        };

        // place bars
        let placed = 0,
            attempts = 0,
            maxAttempts = 80;
        while (placed < bars && attempts++ < maxAttempts) {
            if (tryStampBar()) placed++;
        }
    },
    centerBoardOffset(scene, { rows, cols, tileSize }) {
        const worldW = cols * tileSize;
        const worldH = rows * tileSize;
        const gameW = scene.scale.width;
        const gameH = scene.scale.height;

        return { x: (gameW - worldW) / 2, y: (gameH - worldH) / 2 };
    },
    forms2x2Trap(scene, grid, c, r) {
        const S = (x, y) =>
            isSolid(scene, grid, x, y) || grid[y]?.[x] === undefined;
        // Check 4 quads around (c,r)
        const q1 =
            (S(c, r) && S(c + 1, r)) ||
            (S(c, r) && S(c, r + 1)) ||
            (S(c + 1, r) && S(c, r + 1)) ||
            (S(c + 1, r) && S(c + 1, r + 1));
        const a =
            (S(c, r) && S(c + 1, r) && S(c, r + 1)) ||
            (S(c + 1, r) && S(c + 1, r + 1) && S(c, r + 1)) ||
            (S(c, r) && S(c, r + 1) && S(c + 1, r + 1)) ||
            (S(c + 1, r) && S(c + 1, r + 1) && S(c, r));
        // cheaper: consider any 2x2 with three solids around the box cell as trap
        return a || q1;
    },
    hallwayPinned(scene, grid, c, r) {
        const left = isSolid(scene, grid, c - 1, r);
        const right = isSolid(scene, grid, c + 1, r);
        const up = isSolid(scene, grid, c, r - 1);
        const down = isSolid(scene, grid, c, r + 1);
        return (left && right) || (up && down);
    },
    isBoxStartDeadlocked(scene, grid, targetKeys, c, r) {
        // If the target is exactly here, allow corner/hallway (it may be intended as final)
        const onTarget = isTarget(targetKeys, c, r);

        // Corner against two perpendicular solids and not already on target
        if (!onTarget && isCorner(scene, grid, c, r)) return true;

        // Pinned in a 1-wide hallway (no lateral freedom) and not on target
        if (!onTarget && hallwayPinned(scene, grid, c, r)) return true;

        // 2x2 traps (approximation)
        if (!onTarget && forms2x2Trap(scene, grid, c, r)) return true;

        return false;
    },
    createsBoxPairWallTrap(scene, grid, c, r, boxId) {
        const nbrs = [
            { dc: 1, dr: 0 },
            { dc: -1, dr: 0 },
            { dc: 0, dr: 1 },
            { dc: 0, dr: -1 },
        ];
        for (const { dc, dr } of nbrs) {
            const nc = c + dc,
                nr = r + dr;
            if (!isBox(grid, nc, nr, boxId)) continue;

            // same-side walls for BOTH boxes?
            const sameSide =
                (isSolid(scene, grid, c - 1, r) &&
                    isSolid(scene, grid, nc - 1, nr)) || // both have wall on left
                (isSolid(scene, grid, c + 1, r) &&
                    isSolid(scene, grid, nc + 1, nr)) || // both right
                (isSolid(scene, grid, c, r - 1) &&
                    isSolid(scene, grid, nc, nr - 1)) || // both up
                (isSolid(scene, grid, c, r + 1) &&
                    isSolid(scene, grid, nc, nr + 1)); // both down

            if (sameSide) return true;
        }

        return false;
    },
    creates2x2BoxBlock(grid, c, r, boxId) {
        const B = (x, y) => isBox(grid, x, y, boxId) || (x === c && y === r); // include candidate
        // check four orientations around (c,r)
        return (
            (B(c, r) &&
                isBox(grid, c + 1, r, boxId) &&
                isBox(grid, c, r + 1, boxId) &&
                isBox(grid, c + 1, r + 1, boxId)) ||
            (B(c, r) &&
                isBox(grid, c - 1, r, boxId) &&
                isBox(grid, c, r + 1, boxId) &&
                isBox(grid, c - 1, r + 1, boxId)) ||
            (B(c, r) &&
                isBox(grid, c + 1, r, boxId) &&
                isBox(grid, c, r - 1, boxId) &&
                isBox(grid, c + 1, r - 1, boxId)) ||
            (B(c, r) &&
                isBox(grid, c - 1, r, boxId) &&
                isBox(grid, c, r - 1, boxId) &&
                isBox(grid, c - 1, r - 1, boxId))
        );
    },
    touchesExistingWall(scene, grid, cells) {
        const mask = new Set(cells.map((p) => key(p.c, p.r)));
        const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        for (const { c, r } of cells) {
            for (const [dx, dy] of dirs) {
                const nc = c + dx,
                    nr = r + dy;
                if (!inB(grid, nc, nr)) continue;

                // touching a wall that is NOT part of this bar?
                if (scene.isWallVal(grid[r][c]) && !mask.has(key(nc, nr))) {
                    return true;
                }
            }
        }

        return false;
    },
};

export const {
    buildLevel,
    applySnapshotAnimated,
    isAnyDirectionActive,
    playLevelCompleteFX,
    createAnimations,
    addWallsWithPlayability,
    centerBoardOffset,
    forms2x2Trap,
    hallwayPinned,
    isBoxStartDeadlocked,
    createsBoxPairWallTrap,
    creates2x2BoxBlock,
    touchesExistingWall,
    measureRunLen,
} = Payloads;
