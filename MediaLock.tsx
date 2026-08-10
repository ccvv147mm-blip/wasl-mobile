import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { installMediaLock, stopAllMedia } from "@/lib/media-lock";

/** Mounted once at the root: silences all media on navigation / tab hide. */
export function MediaLock() {
  const router = useRouter();
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => installMediaLock(), []);

  // Stop sound the moment a navigation starts (before the new page renders).
  useEffect(() => {
    const unsubs = [
      router.subscribe("onBeforeNavigate", () => stopAllMedia()),
      router.subscribe("onBeforeLoad", () => stopAllMedia()),
    ];
    return () => unsubs.forEach((u) => u());
  }, [router]);

  // Safety net: any URL change (including back/forward) silences leftovers.
  useEffect(() => {
    stopAllMedia();
    return () => stopAllMedia();
  }, [href]);

  return null;
}
