import * as React from "react";
import { formatNumber } from "../hooks/format";
import { emitEvent, offEvents, onEvents } from "../hooks/EventBus";

const Header = ({ player, onLogout }) => {
    const [isMuted, setIsMuted] = React.useState(false);
    const [score, setScore] = React.useState(0);
    const [level, setLevel] = React.useState(1);

    // Listen for Phaser events and update state
    React.useEffect(() => {
        const events = ["score", "level"];
        const callbacks = [
            (data = 0) => setScore(data),
            (data = 1) => setLevel(data),
        ];

        onEvents({ events, callbacks });
        return () => offEvents({ events, callbacks });
    }, [score, level]);

    return (
        <header className="flex-column justify-content-center align-items-center">
            <div className="d-flex card-header flex-column flex-md-row justify-content-md-between gap-3 p-3">
                {/* Row 1: Stats */}
                <section className="d-flex justify-content-center justify-content-md-start align-items-center gap-4">
                    <div className="text-muted fs-6 fs-md-5">
                        <i className="fa fa-user"></i>
                        <span className="text-info text-capitalize ms-1">
                            {player}
                        </span>
                    </div>

                    <div className="text-muted d-flex align-items-center fs-6 fs-md-5">
                        <i className="fa fa-star text-warning me-1"></i>
                        Score:{" "}
                        <span className="text-warning fw-bold ms-1">
                            {formatNumber(score)}
                        </span>
                    </div>
                    <div className="text-muted d-flex align-items-center fs-6 fs-md-5">
                        <i className="fa fa-level-up-alt text-info me-1"></i>
                        Level:{" "}
                        <span className="text-info fw-bold ms-1">{level}</span>
                    </div>
                </section>

                {/* Row 2: Buttons */}
                <section className="d-flex flex-wrap justify-content-center justify-content-md-end align-items-center gap-2">
                    {/* Sound */}
                    <button
                        title={isMuted ? "Unmute" : "Mute"}
                        aria-label="Mute/Unmute"
                        onClick={() => {
                            const newMute = !isMuted;
                            setIsMuted(newMute);
                            emitEvent("mute", newMute);
                        }}
                        className={`btn btn-sm rounded-circle ${
                            isMuted ? "btn-secondary" : "btn-info"
                        }`}
                    >
                        <i
                            className={`fa ${
                                isMuted ? "fa-volume-mute" : "fa-volume-up"
                            }`}
                        ></i>
                    </button>

                    {/* Exit */}
                    <button
                        title="Logout"
                        aria-label="Logout"
                        onClick={onLogout}
                        className="btn btn-danger btn-sm rounded-circle"
                    >
                        <i className="fa fa-power-off"></i>
                    </button>
                </section>
            </div>
        </header>
    );
};

export default Header;
