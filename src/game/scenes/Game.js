import { emitEvent, emitEvents, onEvent } from "../../hooks/EventBus";
import { COLORS } from "../consts";
import { tryMove } from "../utils/controller";
import {
    buildLevel,
    createAnimations,
    isAnyDirectionActive,
} from "../utils/payload";
import { clearButtons, key, toIdle, undoLastMove } from "../utils/state";

// ----------------------------------------------------------------------------
class GameEngine extends Phaser.Scene {
    constructor() {
        super("game-engine");

        // input & board
        this.cursors = null;
        this.tileSize = 64;
        this.rows = 0;
        this.cols = 0;
        this.offsetX = 0;
        this.offsetY = 0;

        // entities
        this.player = null;
        this.playerGrid = { col: 0, row: 0 };
        this.boxes = [];
        this.boxByKey = new Map();
        this.boxAt = (col, row) => this.boxByKey.get(key(col, row));
        this.targets = [];
        this.targetKeys = new Set(); // <-- distinct Set
        this.forbiddenCells = new Set(); // <-- distinct Set
        this.history = []; // stack of snapshots
        this.maxHistory = 200; // cap to avoid unbounded growth

        // state
        this.isMoving = false;
        this.hasWon = false;
        this.score = 0;
        this.level = 1;
        this.currentPair = COLORS.GREEN;

        // debug / visuals
        this.gridGraphics = null;
        this.gridVisible = true;

        // external buttons (pressed while true)
        this.isLeft = false;
        this.isRight = false;
        this.isUp = false;
        this.isDown = false;

        // keep references so we can cleanly rebuild
        this.floorMap = null;
        this.floorLayer = null;
        this.entMap = null;
        this.entLayer = null;
        this.moveDelay = 120;
        this.nextMoveAt = 0;
    }

    init(data) {
        this.score = data.score || 0;
        this.level = data.level || 1;
        this.hasWon = !!data.has_won || false;
    }

    // ---------- Phaser lifecycle ----------
    create() {
        emitEvent("current-scene-ready", this);
        this.cursors = this.input.keyboard.createCursorKeys();

        this.ensureFxTextures();
        buildLevel(this);
        createAnimations(this);
        this.wireExternalControls();
        this.setupInput();

        this.cameras.main.roundPixels = true;
    }

    update() {
        if (!this.cursors || !this.player || this.hasWon) return;
        if (this.isMoving) return;

        const now = this.time.now;

        // prefer held keys (or external flags)
        if (this.cursors.left.isDown || this.isLeft) {
            if (now >= this.nextMoveAt) {
                tryMove(this, { x: -1, y: 0, animKey: "left" });
                this.nextMoveAt = now + this.moveDelay;
            }
        } else if (this.cursors.right.isDown || this.isRight) {
            if (now >= this.nextMoveAt) {
                tryMove(this, { x: 1, y: 0, animKey: "right" });
                this.nextMoveAt = now + this.moveDelay;
            }
        } else if (this.cursors.up.isDown || this.isUp) {
            if (now >= this.nextMoveAt) {
                tryMove(this, { x: 0, y: -1, animKey: "up" });
                this.nextMoveAt = now + this.moveDelay;
            }
        } else if (this.cursors.down.isDown || this.isDown) {
            if (now >= this.nextMoveAt) {
                tryMove(this, { x: 0, y: 1, animKey: "down" });
                this.nextMoveAt = now + this.moveDelay;
            }
        } else {
            // no key held → allow immediate next move on next press
            this.nextMoveAt = 0;
        }

        // keep UI updated (emit every frame is fine for small games)
        emitEvents({
            events: ["score", "level"],
            args: [this.score, this.level],
        });
    }

    //Input
    setupInput() {
        // Pointer up: clear external buttons and stop anim if not moving
        this.input.on("pointerup", () => {
            clearButtons(this);
            if (!this.isMoving) toIdle(this);
        });

        // Arrow key up: if no other direction is still held, go idle
        this.input.keyboard.on("keyup", (e) => {
            if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.code
                )
            ) {
                // don't force idle if another dir is still down (or external flag is true)
                if (!isAnyDirectionActive(this) && !this.isMoving) toIdle(this);
            }
        });
    }

    // ---------- Controls ----------
    wireExternalControls() {
        onEvent("left", (v) => {
            this.isLeft = !!v;
            if (!v && !isAnyDirectionActive(this) && !this.isMoving)
                toIdle(this);
        });
        onEvent("right", (v) => {
            this.isRight = !!v;
            if (!v && !isAnyDirectionActive(this) && !this.isMoving)
                toIdle(this);
        });
        onEvent("up", (v) => {
            this.isUp = !!v;
            if (!v && !isAnyDirectionActive(this) && !this.isMoving)
                toIdle(this);
        });
        onEvent("down", (v) => {
            this.isDown = !!v;
            if (!v && !isAnyDirectionActive(this) && !this.isMoving)
                toIdle(this);
        });
        onEvent("undo", () => undoLastMove(this));
        onEvent("reset", () => buildLevel(this));
    }

    ensureFxTextures() {
        if (this.textures.exists("fx-dot")) return;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture("fx-dot", 8, 8);
        g.destroy();
    }
}

export default GameEngine;
