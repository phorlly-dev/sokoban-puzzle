import { emitEvent } from "../../hooks/EventBus";

class GameBoot extends Phaser.Scene {
    constructor() {
        super("game-boot");
    }

    preload() {
        this.load.setPath("assets/images/");
        this.load.image("background", "bg.png");

        //Load tiles
        this.load.spritesheet("tiles", "sokoban_tilesheet.png", {
            frameWidth: 64,
            startFrame: 0,
        });
    }

    create() {
        emitEvent("current-scene-ready", this);
        this.scene.start("game-engine");
    }
}

export default GameBoot;
