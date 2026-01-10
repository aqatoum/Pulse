import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import "./styles/theme.css";        // 1) variables first
import "./styles/app.css";          // 2) global layout/components
import "./styles/surveillance.css"; // 3) page-specific
import "./styles/methodology.css";  // 4) page-specific

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
