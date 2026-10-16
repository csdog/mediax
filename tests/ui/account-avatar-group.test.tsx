// @vitest-environment jsdom
import "./setup";
import React from "react";
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountAvatarGroup } from "../../src/renderer/components/calendar/PlatformAvatarGroup";

it("keeps distinct accounts on the same platform and exposes overflow accounts", async () => {
  const publishers = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    name: `账号${index + 1}`,
    platform: "facebook" as const,
  }));
  render(<AccountAvatarGroup publishers={[...publishers, publishers[0]!]} />);

  const trigger = screen.getByRole("button", { name: /^发布账号：/ });
  expect(trigger.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
  expect(within(trigger).getByText("+2")).toBeTruthy();
  await userEvent.hover(trigger);
  expect(await screen.findByRole("heading", { name: "账号5" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: "账号1" })).toHaveLength(1);
});
