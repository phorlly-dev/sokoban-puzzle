import { COLORS, FLOOR, PLAYER, WALL } from "../consts";
import {
    destroyLevelGraphics,
    drawDashedGrid,
    exceedsMaxRunAfterStamp,
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
            row.map((v) => (v === WALL ? WALL : -1))
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
            row.map((v) => (v === FLOOR || v === WALL ? -1 : v))
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
        // if (scene.sound && scene.sound.get("win"))
        //     scene.sound.play("win", { volume: 0.6 });
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
        grid,
        playerPos,
        level,
        {
            startLevel = 3, // no walls below this level
            minDistFromPlayer = 1, // keep walls this far from player start (Manhattan)
            protectTargets = true, // true => don't touch cells next to targets
            targetKeys = new Set(), // Set of "c,r" strings for targets
        } = {}
    ) {
        if (level < startLevel) return;

        const rows = grid.length,
            cols = grid[0].length;

        // difficulty (bars to stamp, length range)
        const bars = Phaser.Math.Clamp(Math.floor(level / 3) + 1, 1, 5);
        const lenMin = 2;
        const lenMax = Math.max(lenMin, Math.min(cols, rows) - 2);

        const isTarget = (c, r) => targetKeys.has(`${c},${r}`);
        const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const isWall = (c, r) => inBounds(c, r) && grid[r][c] === WALL;
        const isFree = (c, r) => inBounds(c, r) && grid[r][c] !== WALL;

        const manhattan = (c, r, c2, r2) => Math.abs(c - c2) + Math.abs(r - r2);
        const nearPlayer = (c, r) =>
            manhattan(c, r, playerPos.col, playerPos.row) <= minDistFromPlayer;

        const nearTarget = (c, r) =>
            isTarget(c, r) ||
            isTarget(c + 1, r) ||
            isTarget(c - 1, r) ||
            isTarget(c, r + 1) ||
            isTarget(c, r - 1);

        // No 1-tile corridor: any non-wall cell must NOT have both L&R walls or both U&D walls
        const createsOneTileCorridor = (cells) => {
            // temporarily mark
            for (const { c, r } of cells) grid[r][c] = WALL;

            let bad = false;
            for (let r = 0; !bad && r < rows; r++) {
                for (let c = 0; !bad && c < cols; c++) {
                    if (grid[r][c] === WALL) continue;
                    const lr = isWall(c - 1, r) && isWall(c + 1, r);
                    const ud = isWall(c, r - 1) && isWall(c, r + 1);
                    if (lr || ud) {
                        // allow if this cell is a target AND still has a 2-tile push lane
                        if (!isTarget(c, r) || !hasAnyPushLane(c, r))
                            bad = true;
                    }
                }
            }

            // rollback temp marks
            for (const { c, r } of cells) grid[r][c] = FLOOR;
            return bad;
        };

        // Target must have at least one direction with [target+dir] free and [target+2*dir] free (the lane to push into it)
        function hasAnyPushLane(tc, tr) {
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
                if (isFree(n1c, n1r) && isFree(n2c, n2r)) return true;
            }
            return false;
        }

        // After stamping, every target must still have a push lane
        const breaksTargetLanes = (cells) => {
            // temp stamp
            for (const { c, r } of cells) grid[r][c] = WALL;

            let broken = false;
            for (const tk of targetKeys) {
                const [tc, tr] = tk.split(",").map(Number);
                if (!hasAnyPushLane(tc, tr)) {
                    broken = true;
                    break;
                }
            }

            // rollback
            for (const { c, r } of cells) grid[r][c] = FLOOR;
            return broken;
        };

        // Standard reachability check (non-wall connectivity from player)
        const bfsReachableCount = (startC, startR) => {
            if (!inBounds(startC, startR) || grid[startR][startC] === WALL)
                return 0;
            const seen = new Set();
            const Q = [{ c: startC, r: startR }];
            seen.add(`${startC},${startR}`);
            while (Q.length) {
                const { c, r } = Q.shift();
                const nbrs = [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ];
                for (const [dx, dy] of nbrs) {
                    const nc = c + dx,
                        nr = r + dy;
                    if (!inBounds(nc, nr) || grid[nr][nc] === WALL) continue;
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
                for (let c = 0; c < cols; c++) if (grid[r][c] !== WALL) n++;
            return n;
        };

        const tryStampBar = () => {
            const horiz = Phaser.Math.Between(0, 1) === 0;
            const L = Phaser.Math.Between(lenMin, lenMax);
            const c0 = Phaser.Math.Between(1, cols - 2);
            const r0 = Phaser.Math.Between(1, rows - 2);

            const cells = [];
            for (let i = 0; i < L; i++) {
                const c = horiz ? c0 + i : c0;
                const r = horiz ? r0 : r0 + i;
                if (c <= 0 || c >= cols - 1 || r <= 0 || r >= rows - 1) break;
                if (grid[r][c] !== FLOOR) return false;
                // (keep your existing nearPlayer / nearTarget checks here)
                cells.push({ c, r });
            }
            if (cells.length < 2) return false;

            // --- PLAYABILITY GUARDS ---
            // 1) don't join bars to existing walls
            if (touchesExistingWall(grid, cells)) return false; // NEW
            // 2) cap continuous run length in the bar direction
            const MAX_RUN = 3; // tune: 2..4 feels good on 6x6
            if (exceedsMaxRunAfterStamp(grid, cells, horiz, MAX_RUN))
                return false; // NEW

            // (keep your corridor / target-lane checks here if you added them)

            // tentative stamp
            for (const { c, r } of cells) grid[r][c] = WALL;

            // connectivity check (your existing BFS)
            const reach = bfsReachableCount(playerPos.col, playerPos.row);
            const total = countWalkable();
            const ok = reach === total;

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

        // optional tiny fallback
        if (placed === 0 && level >= startLevel + 2) {
            for (let r = 1; r < rows - 1; r++) {
                for (let c = 1; c < cols - 1; c++) {
                    const cells = [
                        { c, r },
                        { c: c + 1, r },
                    ];
                    if (grid[r][c] !== FLOOR || grid[r][c + 1] !== FLOOR)
                        continue;
                    if (
                        nearPlayer(c, r) ||
                        (protectTargets &&
                            (nearTarget(c, r) || nearTarget(c + 1, r)))
                    )
                        continue;
                    if (
                        createsOneTileCorridor(cells) ||
                        breaksTargetLanes(cells)
                    )
                        continue;
                    // final stamp + connectivity check
                    for (const { c: cc, r: rr } of cells) grid[rr][cc] = WALL;
                    const ok =
                        bfsReachableCount(playerPos.col, playerPos.row) ===
                        countWalkable();
                    if (!ok) {
                        for (const { c: cc, r: rr } of cells)
                            grid[rr][cc] = FLOOR;
                    } else return;
                }
            }
        }
    },
    centerBoardOffset(scene, { rows, cols, tileSize }) {
        const worldW = cols * tileSize;
        const worldH = rows * tileSize;
        const gameW = scene.scale.width;
        const gameH = scene.scale.height;

        return { x: (gameW - worldW) / 2, y: (gameH - worldH) / 2 };
    },
    forms2x2Trap(grid, c, r) {
        const S = (x, y) => isSolid(grid, x, y) || grid[y]?.[x] === undefined;
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
    hallwayPinned(grid, c, r) {
        const left = isSolid(grid, c - 1, r);
        const right = isSolid(grid, c + 1, r);
        const up = isSolid(grid, c, r - 1);
        const down = isSolid(grid, c, r + 1);
        return (left && right) || (up && down);
    },
    isBoxStartDeadlocked(grid, targetKeys, c, r) {
        // If the target is exactly here, allow corner/hallway (it may be intended as final)
        const onTarget = isTarget(targetKeys, c, r);

        // Corner against two perpendicular solids and not already on target
        if (!onTarget && isCorner(grid, c, r)) return true;

        // Pinned in a 1-wide hallway (no lateral freedom) and not on target
        if (!onTarget && hallwayPinned(grid, c, r)) return true;

        // 2x2 traps (approximation)
        if (!onTarget && forms2x2Trap(grid, c, r)) return true;

        return false;
    },
    createsBoxPairWallTrap(grid, c, r, boxId) {
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
                (isSolid(grid, c - 1, r) && isSolid(grid, nc - 1, nr)) || // both have wall on left
                (isSolid(grid, c + 1, r) && isSolid(grid, nc + 1, nr)) || // both right
                (isSolid(grid, c, r - 1) && isSolid(grid, nc, nr - 1)) || // both up
                (isSolid(grid, c, r + 1) && isSolid(grid, nc, nr + 1)); // both down

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
    touchesExistingWall(grid, cells) {
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
                if (grid[nr][nc] === WALL && !mask.has(key(nc, nr))) {
                    return true;
                }
            }
        }

        return false;
    },
    measureRunLen(grid, c, r, dx, dy) {
        // count contiguous WALLs including (c,r) and both directions
        let len = 0,
            x = c,
            y = r;
        // go backward
        while (inB(grid, x - dx, y - dy) && grid[y - dy][x - dx] === WALL) {
            x -= dx;
            y -= dy;
        }
        // now walk forward
        while (inB(grid, x, y) && grid[y][x] === WALL) {
            len++;
            x += dx;
            y += dy;
        }

        return len;
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
