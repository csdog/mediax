import { createRoot } from "react-dom/client";
import { NativePopupApp } from "./native-popup/NativePopupApp";
import "./style.css";

document.documentElement.classList.add("native-popup");
document.documentElement.dataset.desktopPlatform = window.desktopPlatform ?? "browser";

const root = document.getElementById("root");
if (root) createRoot(root).render(<NativePopupApp />);
