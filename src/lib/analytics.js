import { logEvent } from "firebase/analytics";
import { analytics } from "./firebase";

export const trackPageView = (path) => {
  if (!analytics) return;
  logEvent(analytics, "page_view", {
    page_location: window.location.href,
    page_path: path,
  });
};
