import { userErrorMessage } from "../../shared/userError";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultProfile, type ProfileSettings } from "../../shared/profile";

const profileKey = ["desktop", "profile"] as const;

export function useProfileSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: profileKey,
    queryFn: () => window.desktop.profileSettings(),
  });
  const [message, setMessage] = useState("");
  const save = useMutation({
    mutationFn: (patch: Partial<ProfileSettings>) => {
      const current = client.getQueryData<ProfileSettings>(profileKey) ?? defaultProfile;
      return window.desktop.setProfile({ ...current, ...patch });
    },
    onSuccess: (result) => {
      client.setQueryData(profileKey, result);
      setMessage("");
    },
  });
  const chooseAvatar = async () => {
    setMessage("");
    try {
      const avatar = await window.desktop.chooseAvatar();
      if (avatar) await save.mutateAsync({ avatar });
    } catch (error) {
      setMessage(userErrorMessage(error));
    }
  };
  return {
    profile: settings.data ?? defaultProfile,
    setProfileName: (name: string) => {
      setMessage("");
      save.mutate({ name });
    },
    chooseAvatar,
    clearAvatar: () => {
      setMessage("");
      save.mutate({ avatar: null });
    },
    profileError:
      message || (save.isError ? userErrorMessage(save.error, "保存失败，请稍后重试。") : ""),
  };
}
