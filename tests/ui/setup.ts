import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount while jsdom globals still exist so layout observers and timers stop.
afterEach(cleanup);

// jsdom cannot run NumberFlow's custom-element animation lifecycle. Keep numeric
// content in app workflow tests; exercise the animation in the real desktop UI.
vi.mock("../../src/renderer/components/ui/number-flow", () => ({
  NumberFlow: ({ value }: { value: number }) => React.createElement("span", null, value),
}));
vi.stubGlobal("scrollTo", vi.fn());
