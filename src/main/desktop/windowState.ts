export type Rect = { x: number; y: number; width: number; height: number };
export type WindowState = Rect & { maximized: boolean };

export function restoreWindowState(value: unknown, workAreas: Rect[]): WindowState {
  const primary = workAreas[0] ?? { x: 0, y: 0, width: 1280, height: 820 };
  const state = value as Partial<WindowState> | null;
  const valid =
    state &&
    [state.x, state.y, state.width, state.height].every(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
  const area = valid
    ? (workAreas.find(
        (a) =>
          state.x! < a.x + a.width &&
          state.x! + state.width! > a.x &&
          state.y! < a.y + a.height &&
          state.y! + state.height! > a.y,
      ) ?? primary)
    : primary;
  const width = Math.round(
    Math.min(area.width, Math.max(Math.min(960, area.width), valid ? state.width! : 1280)),
  );
  const height = Math.round(
    Math.min(area.height, Math.max(Math.min(640, area.height), valid ? state.height! : 820)),
  );
  const x = valid ? state.x! : area.x + (area.width - width) / 2;
  const y = valid ? state.y! : area.y + (area.height - height) / 2;
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
    width,
    height,
    maximized: valid ? state.maximized === true : false,
  };
}
