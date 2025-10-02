import * as React from "react";
import { offEvents, onEvents } from "../hooks/EventBus";

// Lazy load the Phaser game
const PhaserGame = React.lazy(() => import("./PhaserGame"));
const Header = React.lazy(() => import("./Header"));
const Footer = React.lazy(() => import("./Footer"));

const Content = ({ player, onLogout }) => {
    const phaserRef = React.useRef();

    return (
        <div className="game-container bg-secondary bg-opacity-75">
            <div className="card m-0">
                {/* HEADER */}
                <Header player={player} onLogout={onLogout} />

                {/* GAME BOARD */}
                <main className="card-body d-flex justify-content-center">
                    <PhaserGame
                        ref={phaserRef}
                        player={player}
                        style={{ maxWidth: "400px", width: "100%" }}
                    />
                </main>

                {/* FOOTER */}
                <Footer />
            </div>
        </div>
    );
};

export default Content;
