import { createRoot } from "react-dom/client";
import { initializeRendererLogging } from "./lib/logging";
import { App } from "./app/App";
import "./style.css";
export { App } from "./app/App";
initializeRendererLogging();
document.documentElement.dataset.desktopPlatform = window.desktopPlatform ?? "browser";
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
