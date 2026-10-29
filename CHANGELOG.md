# Changelog

All notable changes to `@thatoneneji/mikronode-ng` are listed here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-10-29

### Added

- `examples/monitorLog.js`: `/log/print` in `follow-only` (new entries only, the default) or `follow`
  (all previous entries, then new ones) mode.
- `CHANGELOG.md`, included in the npm package.

### Fixed

- Named channels (`connection.openChannel('log')`) now receive `read`/`data` events. Rows were only
  delivered to channels with a numeric id, so a named channel running a streaming command
  (`follow`, `monitor-traffic`, `listen`, ...) silently got nothing. Commands that end with `done` were
  not affected.

### Changed

- eslint dev dependency bumped to `^10.13.0`.

## [1.4.0] - 2026-08-29

### Added

- Examples matching the `node-red-contrib-mikronode-ng` nodes: `getInformation.js`, `monitorTraffic.js`,
  `monitorRoutes.js`, `monitorWifiRegistration.js`, `monitorOvpnClient.js`.

### Changed

- `examples/getInterfaces.js`, `getIpList.js` and `monitorMultipleWithReconnect.js` reworked.
- Lint now covers `examples/` as well as `lib/`, with stricter rules (`curly`, 4-space `indent`, ...).

### Removed

- The Readme's "Upgrading from versions < 1.0.0" section.

## [1.3.0] - 2026-08-29

### Changed

- **`parseItems()` now returns numbers for numeric values.** Integers and decimals are converted with
  `Number()`; everything else stays a string, including `.id` values like `*80000001`, MAC and IP
  addresses, `true`/`false`, and integers too large for a JS number to hold exactly (e.g. long-running
  byte counters). Code that expected every value to be a string may need updating.

### Fixed

- A socket error during login, for example while re-logging in after a reconnect, no longer crashes
  the process with an unhandled `error` event.

## [1.2.0] - 2026-08-29

### Removed

- **Support for RouterOS versions before 7.x.** Login is now the single-step `/login =name= =password=`;
  the old two-step MD5 challenge login (RouterOS before 6.43) is gone.

## [1.1.0] - 2026-08-28

First release of the fork, published as `@thatoneneji/mikronode-ng`.

### Added

- Opt-in automatic reconnect: `options.reconnect` (`true` or `{retries, delay, maxDelay, factor}`, with
  exponential backoff) and `reconnecting`/`reconnected` events. Channels do not survive a reconnect;
  reopen them in the `reconnected` handler.
- Examples, including `monitorMultipleWithReconnect.js`.
- `LICENSE` (MIT).

### Changed

- Package renamed from `mikronode-ng` to `@thatoneneji/mikronode-ng`.
- Requires Node.js 22 or later.
- Dependencies updated (`debug` 4, `jsdoc` 4, grunt plugins); `lib/` passes eslint.
- Generated `doc/` HTML is no longer committed; build it with `npm run documentation`.

### Fixed

- A clean disconnect from the device is now detected (the socket's `close` event was not handled).
- Reconnecting resets the sentence-parser state, which could otherwise corrupt the next login.

## 1.0.11 and earlier

Releases of the original [`mikronode-ng`](https://github.com/gtjoseph/mikronode-ng) by Brandon Myers
and George Joseph.

[Unreleased]: https://github.com/ThatOneNeji/mikronode-ng/compare/v1.5.0...develop
[1.5.0]: https://github.com/ThatOneNeji/mikronode-ng/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/ThatOneNeji/mikronode-ng/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/ThatOneNeji/mikronode-ng/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/ThatOneNeji/mikronode-ng/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ThatOneNeji/mikronode-ng/releases/tag/v1.1.0
