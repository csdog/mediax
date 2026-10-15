import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { platformIcons } from "@/assets/platformIcons";
import { cn } from "cn";
import type { PlatformId } from "../../shared/models";
import { platformInfo } from "../../shared/platforms";

export function PlatformGlyph({ id }: { id: PlatformId }) {
  const icon = platformIcons[id];
  if (icon) return <img src={icon} alt="" className="platform-icon" />;
  return (
    <span
      className={id === "facebook" ? "facebook-mark" : "platform-mark"}
      style={id === "facebook" ? undefined : { background: platformInfo[id].color }}
      aria-hidden="true"
    >
      {platformInfo[id].mark}
    </span>
  );
}

/** Same structure as Account Management「账号信息」. */
export function AccountIdentity({
  name,
  platform,
  avatar,
  className,
  detail,
  titleAdornment,
}: {
  name: string;
  platform: PlatformId;
  avatar?: string | null;
  className?: string;
  /** Extra line under the platform label (e.g. publish identity). */
  detail?: ReactNode;
  /** Inline mark next to the account name (e.g. customized-content dot). */
  titleAdornment?: ReactNode;
}) {
  return (
    <div className={cn("account-identity", className)}>
      <Avatar className="size-10">
        {avatar ? <AvatarImage src={avatar} alt={`${name} 头像`} /> : null}
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate">{name}</span>
          {titleAdornment}
        </h2>
        <p className="account-platform-label">
          <PlatformGlyph id={platform} />
          {platformInfo[platform].label}
        </p>
        {detail ? <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}
