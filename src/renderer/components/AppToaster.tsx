import {
  CircleAlert,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Toaster } from "sonner";

/** Mirrors angryecho-web `SonnerX` + app.vue toaster props. */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      richColors
      duration={5_000}
      visibleToasts={3}
      className="toaster group"
      style={{ ["--width" as string]: "88vw" }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <CircleAlert className="size-5" />,
        loading: (
          <div>
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ),
        close: <XIcon className="size-5" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
}
