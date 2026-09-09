const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const link = (value) => {
  const url = new URL(value);
  if (!["https:", "mailto:"].includes(url.protocol))
    throw new Error("Public identity links must use HTTPS or mailto.");
  return escape(url.href);
};
export function renderSite(site) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(site.title)}</title><meta name="description" content="${escape(site.tagline)}"><link rel="icon" href="/fidj-logo.png"><link rel="stylesheet" href="/main.css"></head><body class="site-home">
  <header class="topbar"><a class="brand" href="/">${escape(site.title)}</a><nav class="site-nav"><a href="#resume">CV / Résumé</a><a href="${link(site.contact)}">Contact</a><a class="workspace-link" href="/app">My space ↗</a></nav></header>
  <main><section class="personal-hero"><div class="mario-scene"><img src="/hero.gif" alt="${escape(site.imageAlt)}" width="640" height="480"></div><div class="personal-intro"><p class="eyebrow">${escape(site.handle)}</p><h1>${escape(site.heading)}</h1><p class="personal-tagline">${escape(site.tagline)}</p><p>${escape(site.intro)}</p><div class="site-links"><a class="site-primary" href="#resume">CV / Résumé ↓</a><a href="${link(site.aboutUrl)}">About me ↗</a></div><p class="personal-contact">${(site.links || []).map((item) => `<a href="${link(item.url)}">${escape(item.label)} ↗</a>`).join(" · ")}</p></div></section>
  <section id="resume" class="resume-section"><div class="resume-intro"><p class="eyebrow">EXPERIENCE &amp; BACKGROUND</p><h2>CV / Résumé</h2><p>${escape(site.resumeIntro)}</p><a href="${link(site.aboutUrl)}">Read the full résumé ↗</a></div><div class="resume-timeline">${site.experience.map((item) => `<article><p class="resume-period">${escape(item.period)}</p><h3>${escape(item.role)} <span>· ${escape(item.company)}</span></h3><p>${escape(item.summary)}</p></article>`).join("")}<article><p class="eyebrow">EDUCATION &amp; CERTIFICATIONS</p>${site.education.map((item) => `<p>${escape(item)}</p>`).join("")}</article></div></section>
  <section class="personal-footer card"><div><h2>Let’s build something.</h2><p>${escape(site.closing)}</p></div><a class="site-primary" href="${link(site.contact)}">Get in touch ↗</a></section>
  <footer><img src="/fidj-logo.png" alt="Fidj"> Built with Fidj · <a href="/app">Private space &amp; privacy controls</a></footer></main></body></html>`;
}
