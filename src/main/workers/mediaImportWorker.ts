/**
 * UtilityProcess entry: decode Markdown / media off the Electron main UI thread.
 * Protocol: parent → { id, paths, kind }; child → { id, ok, result | error }.
 */
import type { ContentKind } from "../../shared/models";
import { importLocalPaths } from "../content/mediaAssets";

type Request = { id: number; paths: string[]; kind: ContentKind };

const port = process.parentPort;
if (!port) throw new Error("mediaImportWorker must run as a UtilityProcess");

port.on("message", (event) => {
  const request = event.data as Request;
  void (async () => {
    try {
      const result = await importLocalPaths(request.paths, request.kind, new Map());
      port.postMessage({ id: request.id, ok: true, result });
    } catch (error) {
      port.postMessage({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
});

port.postMessage({ ready: true });
