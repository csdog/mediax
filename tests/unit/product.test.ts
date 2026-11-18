import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import {
  productAppId,
  productId,
  productIpcChannel,
  productName,
  productProtocol,
} from "../../src/shared/product";

it("keeps electron-builder metadata aligned with product constants", () => {
  const yml = readFileSync(resolve(__dirname, "../../electron-builder.yml"), "utf8");
  expect(yml).toMatch(new RegExp(`^appId: ${productAppId}$`, "m"));
  expect(yml).toMatch(new RegExp(`^productName: ${productName}$`, "m"));
  expect(yml).toContain(`- name: ${productProtocol}`);
  expect(yml).toMatch(new RegExp(`^\\s+- ${productId}$`, "m"));
});

it("keeps sandboxed preload channel names aligned with productId", () => {
  const popup = readFileSync(resolve(__dirname, "../../src/preload/native-popup.ts"), "utf8");
  const toast = readFileSync(resolve(__dirname, "../../src/preload/native-toast.ts"), "utf8");
  expect(popup).toContain(`"${productIpcChannel("native-popup")}"`);
  expect(popup).toContain(`"${productIpcChannel("native-popup-notify")}"`);
  expect(toast).toContain(`"${productIpcChannel("toast-overlay-event")}"`);
});
