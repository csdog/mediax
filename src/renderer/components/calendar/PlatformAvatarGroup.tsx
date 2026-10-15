import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { platformIcons } from "@/assets/platformIcons";
import { cn } from "cn";
import type { PlatformId } from "../../../shared/models";
import { platformInfo } from "../../../shared/platforms";

const MAX_VISIBLE = 3;

export type CalendarPublisher = {
  platform: PlatformId;
  name: string;
  avatar?: string | null;
};

type PlatformAvatarGroupProps = {
  publishers: CalendarPublisher[];
  size?: "sm" | "default";
  className?: string;
};

/** Stacked platform marks for calendar event cards. */
export function PlatformAvatarGroup({
  publishers,
  size = "sm",
  className,
}: PlatformAvatarGroupProps) {
  const platforms = uniquePlatforms(publishers);
  if (!platforms.length) return null;

  const visible = platforms.slice(0, MAX_VISIBLE);
  const extra = platforms.length - visible.length;

  return (
    <AvatarGroup
      className={cn(
        "shrink-0",
        size === "sm" && "-space-x-1.5 *:data-[slot=avatar]:ring-1",
        className,
      )}
      data-size={size}
      title={platforms.map((id) => platformInfo[id].label).join("、")}
    >
      {visible.map((id) => (
        <PlatformAvatar key={id} id={id} size={size} />
      ))}
      {extra > 0 ? (
        <AvatarGroupCount className={size === "sm" ? "size-5 text-[10px]" : undefined}>
          +{extra}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

function PlatformAvatar({ id, size }: { id: PlatformId; size: "sm" | "default" }) {
  const icon = platformIcons[id];
  const info = platformInfo[id];
  return (
    <Avatar size={size} className={size === "sm" ? "size-5" : undefined} aria-label={info.label}>
      {icon ? <AvatarImage src={icon} alt="" /> : null}
      <AvatarFallback
        className="text-[10px] font-semibold text-white"
        style={{ background: info.color }}
      >
        {info.mark}
      </AvatarFallback>
    </Avatar>
  );
}

function uniquePlatforms(publishers: CalendarPublisher[]): PlatformId[] {
  const seen = new Set<PlatformId>();
  const result: PlatformId[] = [];
  for (const item of publishers) {
    if (seen.has(item.platform)) continue;
    seen.add(item.platform);
    result.push(item.platform);
  }
  return result;
}
