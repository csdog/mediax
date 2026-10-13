import { Toaster } from "sonner";

/** Global toasts sit above the settings full-page overlay (z-index 20). */
export function AppToaster() {
  return (
    <Toaster
      theme="system"
      position="top-right"
      richColors
      closeButton
      duration={7000}
      offset={{ top: 56, right: 16 }}
      style={{ zIndex: 80 }}
      toastOptions={{
        classNames: {
          toast: "app-toast",
        },
      }}
    />
  );
}
