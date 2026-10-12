/// <reference types="vite/client" />
import type { DesktopApi } from "../shared/models";
declare global {
  interface Window {
    desktop: DesktopApi;
  }
}
