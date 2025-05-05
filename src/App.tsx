import React from "react";
import QRGenerator from "./components/QRGenerator";
import "./App.css";

function App() {
    return (
        <div className="app">
            <header>
                <img
                    src="/images/logo/logoandstuff.png"
                    alt="logo and stuff"
                    className="logo"
                />
            </header>
            <main>
                <QRGenerator logoSrc="/images/logo/WRSS_WIT_Logo.svg" />
            </main>
            <footer>
                <p>
                    Made with ❤️ by{" "}
                    <a
                        href="https://github.com/FOXjustFOX"
                        target="_blank"
                        rel="noopener noreferrer">
                        Igor Lis
                    </a>
                </p>
            </footer>
        </div>
    );
}

export default App;
