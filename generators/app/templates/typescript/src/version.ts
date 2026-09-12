export function showVersionBadge(version: string, apiEndpoint?: string): void {
  if (!/^\d{2}\.\d{2}\.\d{2}$/.test(version || "")) return;
  const badge = document.createElement("div");
  badge.className = "fidj-version";
  badge.setAttribute("aria-label", `App version ${version}`);
  badge.textContent = `v${version}`;
  document.body.append(badge);
  if (apiEndpoint) {
    void fetch(`${apiEndpoint.replace(/\/$/, "")}/status`)
      .then(response => response.ok ? response.json() : null)
      .then(status => {
        const apiVersion = status?.version || status?.built;
        if (!apiVersion) return;
        badge.textContent = `v${version} · API ${apiVersion}`;
        badge.setAttribute("aria-label", `App version ${version}, API version ${apiVersion}`);
      })
      .catch(() => undefined);
  }
}
