import * as React from "react";

const Banner = ({ onClose }) => {
    const [visible, setVisible] = React.useState(true);

    if (!visible) return null;

    return (
        <div
            className="position-fixed top-0 start-0 w-100 px-2 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75"
            style={{ zIndex: 1050 }}
        >
            <div className="position-relative bg-white rounded shadow-lg p-0">
                {/* Close Button */}
                <button
                    className="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 rounded-circle"
                    aria-label="Close"
                    title="Close"
                    onClick={() => {
                        setVisible(false);
                        onClose();
                    }}
                >
                    <i className="fa fa-close"></i>
                </button>

                {/* Banner Image with Link */}
                <a
                    href="https://konohatoto78scatter.com/register?referral_code=hambajackpot"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src="/assets/images/banner.webp"
                        alt="Promote Banner"
                        className="img-fluid rounded"
                        style={{ maxWidth: "360px", cursor: "pointer" }}
                    />
                </a>
            </div>
        </div>
    );
};

export default Banner;
