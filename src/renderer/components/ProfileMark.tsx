import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileInitials } from "../../shared/profile";

export function ProfileMark({
  name,
  avatar,
  size = "default",
  className,
}: {
  name: string;
  avatar: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {avatar ? <AvatarImage src={avatar} alt="" /> : null}
      <AvatarFallback className={size === "sm" ? "text-[9px]" : undefined}>
        {profileInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
