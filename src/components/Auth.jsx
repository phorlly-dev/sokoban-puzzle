import * as React from "react";

const Auth = ({ onAuth }) => {
    const [name, setName] = React.useState("");
    const [touched, setTouched] = React.useState(false);

    const isTooShort = name.trim().length > 0 && name.trim().length < 2;
    const isValid = name.trim().length >= 2;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!isValid) return;
        onAuth(name.trim());
    };

    return (
        <div className="d-flex align-items-center justify-content-center min-vh-100">
            <div
                className="shadow-lg border-0 rounded-4 p-4 bg-dark bg-opacity-75 text-center"
                style={{ maxWidth: "400px", width: "100%" }}
            >
                {/* Title */}
                <h3 className="fw-bold text-info mb-2">Sokoban-Puzzle Game</h3>
                <p className="text-light mb-4">
                    Enter your name to start playing!
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="d-grid gap-3">
                    <input
                        type="text"
                        placeholder="Enter your name"
                        className={`form-control ${
                            touched && isTooShort
                                ? "is-invalid"
                                : isValid
                                ? "is-valid"
                                : ""
                        }`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />

                    {/* Warning */}
                    {touched && isTooShort && (
                        <div className="invalid-feedback d-block">
                            Name must be at least 2 characters
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!isValid}
                        className={`btn btn-lg fw-semibold shadow-sm ${
                            isValid ? "btn-info text-white" : "btn-secondary"
                        }`}
                    >
                        <i className="fa fa-play me-2"></i>
                        Log In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Auth;
