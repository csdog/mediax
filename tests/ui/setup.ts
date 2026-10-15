import React from "react";
import { vi } from "vitest";

// jsdom cannot run NumberFlow's custom-element animation lifecycle. Keep numeric
// content in app workflow tests; exercise the animation in the real desktop UI.
vi.mock("../../src/renderer/components/ui/number-flow", () => ({
  NumberFlow: ({ value }: { value: number }) => React.createElement("span", null, value),
}));
vi.stubGlobal("scrollTo", vi.fn());
