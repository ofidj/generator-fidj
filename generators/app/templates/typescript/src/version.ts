export function showVersionBadge(version: string, apiEndpoint?: string): void {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version || "")) return;
  const badge = document.createElement("div");
  badge.className = "fidj-version";
  badge.setAttribute("aria-label", `Fidj version ${version}`);
  badge.textContent = `fidj@${version}`;
  document.body.append(badge);
  if (apiEndpoint) {
    void fetch(`${apiEndpoint.replace(/\/$/, "")}/status`)
      .then(response => response.ok ? response.json() : null)
      .then(status => {
        const apiVersion = status?.version || status?.built;
        if (!apiVersion) return;
        badge.textContent = `fidj@${version} · API ${apiVersion}`;
        badge.setAttribute("aria-label", `Fidj version ${version}, API version ${apiVersion}`);
      })
      .catch(() => undefined);
  }
}
