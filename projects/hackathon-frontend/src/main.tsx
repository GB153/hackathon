import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/App.css";
import ErrorBoundary from "./components/algorand_stuff/ErrorBoundary";

console.log("VITE_NETWORK =", import.meta.env.VITE_NETWORK);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
