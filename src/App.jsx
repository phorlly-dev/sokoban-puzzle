import * as React from "react";
import Auth from "./components/Auth";

const Content = React.lazy(() => import("./components/Content"));
const Banner = React.lazy(() => import("./components/Banner"));
const App = () => {
    const [showBanner, setShowBanner] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [player, setPlayer] = React.useState(null);

    // Load game data when player logs in
    React.useEffect(() => {
        const savedName = localStorage.getItem("player");
        if (savedName) setPlayer(savedName);
        setLoading(false);
        setShowBanner(true);
    }, []);

    if (!player) {
        return (
            <Auth
                onAuth={(name) => {
                    setPlayer(name);
                    localStorage.setItem("player", name);
                    setLoading(true);
                    setShowBanner(true);
                }}
            />
        );
    } else if (showBanner) {
        return (
            <Banner
                onClose={() => {
                    setShowBanner(false);
                    setLoading(false);
                }}
            />
        );
    } else {
        return (
            <React.Suspense fallback={loading && <div> Loading... </div>}>
                <Content
                    player={player}
                    onLogout={() => {
                        localStorage.removeItem("player");
                        setPlayer(null);
                        setLoading(true);
                        setShowBanner(true);
                    }}
                />
            </React.Suspense>
        );
    }
};

export default App;
