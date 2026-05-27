# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-05-27

### Changed

- **Renamed package from `generator-fidj` to `@ofidj/generator-fidj`.** Scope aligns with the `ofidj` GitHub organisation and the `@ofidj/*` family. Reset semver to `1.0.0`.
- Yeoman command changes: `yo fidj` → `yo @ofidj/fidj` (scoped generator convention).
- The old `generator-fidj@3.x` npm package is deprecated; migrate to `@ofidj/generator-fidj`.
- Templates (`app2018`, `app2021`) inherited unchanged from `generator-fidj@3.3.6` — they still scaffold against the legacy `fidj@3` package. A new `app2026` template targeting `@ofidj/angular` is planned (FIDJ-41).

### Added

- `publishConfig.access: public` and `bugs` metadata for npm publication under scope.
