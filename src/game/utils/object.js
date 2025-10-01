import { makeAnims } from "./helper";
import { isBox, isSolid } from "./state";

const Objects = {
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
    createAnimations(scene) {
        makeAnims(scene, "tiles", [
            { key: "left", start: 81, end: 83 },
            { key: "right", start: 78, end: 80 },
            { key: "up", start: 55, end: 57 },
            { key: "down", start: 52, end: 54 },
        ]);
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
};

export const {
    drawDashedGrid,
    createAnimations,
    createsBoxPairWallTrap,
    creates2x2BoxBlock,
} = Objects;
