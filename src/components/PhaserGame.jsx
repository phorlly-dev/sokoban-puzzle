import * as React from "react";
import StartGame from "../game/main";
import { offEvent, onEvent } from "../hooks/EventBus";

const PhaserGame = React.forwardRef(({ player, props }, ref) => {
    const game = React.useRef();

    React.useLayoutEffect(() => {
        if (!game.current) {
            game.current = StartGame("game-container");

            if (ref) {
                ref.current = { game: game.current, scene: null };
            }
        }

        return () => {
            if (game.current) {
                game.current.destroy(true);
                game.current = undefined;
            }
        };
    }, [ref]);

    // listen for scene ready event
    React.useEffect(() => {
        const handleSceneReady = async (scene) => {
            if (ref && ref.current) {
                ref.current.scene = scene;
                scene.player = player;
            }
        };

        onEvent("current-scene-ready", handleSceneReady);
        return () => offEvent("current-scene-ready", handleSceneReady);
    }, [ref, player]);

    return <div id="game-container" {...props}></div>;
});

export default PhaserGame;
