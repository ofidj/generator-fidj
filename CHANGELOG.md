# Changelog

## 1.0.1 — Unreleased

- Configure anonymous entry with `--anonymous true|false`; mleweb explicitly disables it.

- Restore the login-first flow: sign-in or explicit anonymous entry opens Content, with privacy in a separate view.

- Make the TypeScript client/Node backend template the maintained default through CLI and Yeoman.
- Add live SDK session verification, role-controlled notes, privacy flows and generated HTTP tests.
- Refuse overwriting non-empty projects; support an explicit local SDK path during coordinated development.
- Use mleweb as the downstream clean-generation GitHub Actions fixture.

- Accept title, welcome, HTML content and domain through the public CLI; generate a static SDK app and `www/CNAME` with no downstream site renderer.
- Add guarded regeneration and a CLI acceptance test; retain Studio Notes as the separate server authorization example.
- Remove unused TSLint/welcome dependencies so clean installs do not depend on unpinned TypeScript peer resolution.
