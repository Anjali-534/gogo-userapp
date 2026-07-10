import { useEffect } from "react";
import { router } from "expo-router";

// Safety net: any unrecognized deep-link path lands here and gets bounced
// to the index screen instead of showing the default black "Unmatched
// Route" error screen.
export default function NotFound() {
  useEffect(() => {
    router.replace("/");
  }, []);
  return null;
}
