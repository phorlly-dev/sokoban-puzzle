import * as React from "react";
import { emitEvent } from "../hooks/EventBus";

const Footer = () => {
    React.useEffect(() => {}, []);
    const handlePress = (key) => emitEvent(key, true);
    const handleRelease = (key) => emitEvent(key, false);

    return (
        <footer className="d-flex flex-column mt-0">
            <section className="d-flex card-footer justify-content-center align-items-center w-100 p-3 gap-2">
                <button
                    onPointerDown={() => handlePress("left")}
                    onPointerUp={() => handleRelease("left")}
                    title="Left"
                    aria-label="Left"
                    className="btn btn-primary btn-sm rounded-circle mx-2"
                >
                    <i className="fa fa-arrow-left"></i>
                </button>
                <button
                    onPointerDown={() => handlePress("up")}
                    onPointerUp={() => handleRelease("up")}
                    title="Up"
                    aria-label="Up"
                    className="btn btn-secondary btn-sm rounded-circle mx-2"
                >
                    <i className="fa fa-arrow-up"></i>
                </button>
                <button
                    onPointerDown={() => handlePress("down")}
                    onPointerUp={() => handleRelease("down")}
                    title="Down"
                    aria-label="Down"
                    className="btn btn-secondary btn-sm rounded-circle mx-2"
                >
                    <i className="fa fa-arrow-down"></i>
                </button>
                <button
                    onPointerDown={() => handlePress("right")}
                    onPointerUp={() => handleRelease("right")}
                    title="Right"
                    aria-label="Right"
                    className="btn btn-primary btn-sm rounded-circle mx-2"
                >
                    <i className="fa fa-arrow-right"></i>
                </button>
                <button
                    onClick={() => emitEvent("undo")}
                    title="Undo"
                    aria-label="Undo"
                    className="btn btn-dark btn-sm rounded-circle ms-2"
                >
                    <i className="fa fa-undo"></i>
                </button>
                <button
                    onClick={() => emitEvent("reset")}
                    title="Reset"
                    aria-label="Reset"
                    className="btn btn-danger btn-sm rounded-circle"
                >
                    <i className="fa fa-refresh"></i>
                </button>
            </section>
        </footer>
    );
};

export default Footer;
