export function showVersionBadge(version: string): void {
  if (!/^\d{2}\.\d{2}\.\d{2}$/.test(version || "")) return;
  const badge = document.createElement("div");
  badge.className = "fidj-version";
  badge.setAttribute("aria-label", `App version ${version}`);
  badge.textContent = `v${version}`;
  document.body.append(badge);
}
