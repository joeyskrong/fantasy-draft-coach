import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { DraftProvider } from "./state/draftStore";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DraftProvider>
      <App />
    </DraftProvider>
  </StrictMode>,
);
