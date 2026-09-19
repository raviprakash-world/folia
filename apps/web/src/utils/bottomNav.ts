/** Screens where a persistent bottom bar would get in the way (focused flows and dashboards). */
const HIDDEN_ON = [/^\/product\//, /^\/checkout/, /^\/admin/, /^\/seller(\/|$)/, /^\/account\/(login|register|forgot-password|reset-password|verify-email)/];

export function shouldShowBottomNav(pathname: string) {
  return !HIDDEN_ON.some((re) => re.test(pathname));
}
