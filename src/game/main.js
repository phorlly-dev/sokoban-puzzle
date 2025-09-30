import * as Phaser from "phaser";
import GameEngine from "./scenes/Game";
import GameBoot from "./scenes/Boot";
import { HEIGHT, WIDTH } from "./consts";

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: Phaser.AUTO,
    backgroundColor: "#fff",
    width: WIDTH,
    height: HEIGHT,
    physics: {
        default: "arcade",
        debug: false,
        arcade: {
            gravity: { y: 200 },
        },
    },
    render: { pixelArt: true, roundPixels: true },
    scene: [GameBoot, GameEngine],
};

const StartGame = (parent) => new Phaser.Game({ ...config, parent });

export default StartGame;
