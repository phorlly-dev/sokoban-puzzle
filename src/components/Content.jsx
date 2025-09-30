import * as React from "react";
import { offEvents, onEvents } from "../hooks/EventBus";

// Lazy load the Phaser game
const PhaserGame = React.lazy(() => import("./PhaserGame"));
const Header = React.lazy(() => import("./Header"));
const Footer = React.lazy(() => import("./Footer"));

const Content = ({ player, onLogout }) => {
    const phaserRef = React.useRef();
    const [isFooter, setIsFooter] = React.useState(true);
    const [isHeader, setIsHeader] = React.useState(false);

    React.useEffect(() => {
        const events = ["header", "footer"];
        const callbacks = [
            (data = false) => setIsFooter(data),
            (data = false) => setIsHeader(data),
        ];

        onEvents({ events, callbacks });
        return () => offEvents({ events, callbacks });
    }, [isHeader]);

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
                <Footer isFooter={isFooter} />
            </div>
        </div>
    );
};

export default Content;
