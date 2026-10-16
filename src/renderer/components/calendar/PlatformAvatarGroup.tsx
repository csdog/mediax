import { UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AccountIdentity } from "@/components/AccountIdentity";
import { platformIcons } from "@/assets/platformIcons";
import { cn } from "cn";
import type { PlatformId } from "../../../shared/models";
import { platformInfo } from "../../../shared/platforms";

const MAX_VISIBLE = 3;

export type CalendarPublisher = {
  id?: string;
  platform: PlatformId;
  name: string;
  avatar?: string | null;
};

type PlatformAvatarGroupProps = {
  publishers: CalendarPublisher[];
  size?: "sm" | "default";
  className?: string;
};

/** Stacked platform marks; hover lists accounts like Account Management「账号信息」. */
export function PlatformAvatarGroup(props: PlatformAvatarGroupProps) {
  return <PublisherAvatarGroup {...props} variant="platform" />;
}

/** Stacked account avatars; distinct accounts on the same platform remain visible. */
export function AccountAvatarGroup(props: PlatformAvatarGroupProps) {
  return <PublisherAvatarGroup {...props} variant="account" />;
}

function PublisherAvatarGroup({
  publishers,
  size = "sm",
  className,
  variant,
}: PlatformAvatarGroupProps & { variant: "platform" | "account" }) {
  const platforms = uniquePlatforms(publishers);
  if (!platforms.length) return null;

  const accounts = uniquePublishers(publishers);
  const visiblePlatforms = platforms.slice(0, MAX_VISIBLE);
  const visibleAccounts = accounts.slice(0, MAX_VISIBLE);
  const extra = Math.max(
    0,
    (variant === "account" ? accounts.length : platforms.length) - MAX_VISIBLE,
  );

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex max-w-full cursor-default rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              className,
            )}
            aria-label={
              variant === "account"
                ? `发布账号：${accounts.map((account) => `${account.name}（${platformInfo[account.platform].label}）`).join("、")}`
                : platforms.map((id) => platformInfo[id].label).join("、")
            }
          >
            <AvatarGroup
              className={cn(
                "shrink-0",
                size === "sm" && "-space-x-1.5 *:data-[slot=avatar]:ring-1",
              )}
              data-size={size}
            >
              {variant === "account"
                ? visibleAccounts.map((account) => (
                    <Avatar
                      key={account.id ?? `${account.platform}:${account.name}`}
                      size={size}
                      className={size === "sm" ? "size-5" : undefined}
                      aria-label={account.name}
                    >
                      {account.avatar ? (
                        <AvatarImage src={account.avatar} alt={`${account.name} 头像`} />
                      ) : null}
                      <AvatarFallback className="bg-transparent text-foreground">
                        <UserRound className={size === "sm" ? "size-3.5" : "size-5"} aria-hidden />
                      </AvatarFallback>
                    </Avatar>
                  ))
                : visiblePlatforms.map((id) => <PlatformAvatar key={id} id={id} size={size} />)}
              {extra > 0 ? (
                <AvatarGroupCount className={size === "sm" ? "size-5 text-[10px]" : undefined}>
                  +{extra}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          </button>
        }
      />
      <HoverCardContent className="w-auto min-w-[220px] p-3" align="start" side="bottom">
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li key={account.id ?? `${account.platform}:${account.name}`}>
              <AccountIdentity
                name={account.name}
                platform={account.platform}
                avatar={account.avatar}
              />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
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

function uniquePublishers(publishers: CalendarPublisher[]): CalendarPublisher[] {
  const seen = new Set<string>();
  const result: CalendarPublisher[] = [];
  for (const item of publishers) {
    const key = item.id ?? `${item.platform}:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
