import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppRouter } from "./features/app/components/AppRouter";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter>
      <App />
    </AppRouter>
  </React.StrictMode>,
);
