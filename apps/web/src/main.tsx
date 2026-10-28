import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/styles/index.css";

import { App } from "./app/App";

const container: HTMLElement | null = document.getElementById("root");
if (container === null) {
  throw new Error("The #root element is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
