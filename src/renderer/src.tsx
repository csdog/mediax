import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./style.css";
export { App } from "./app/App";
document.documentElement.dataset.desktopPlatform = window.desktopPlatform ?? "browser";
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
