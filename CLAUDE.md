# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@thatoneneji/mikronode-ng`: an async MikroTik RouterOS API library for Node.js (RouterOS **7.x only**
since 1.2.0, Node >= 22). Forked from the archived `gtjoseph/mikronode-ng` to github.com/ThatOneNeji/mikronode-ng.
It is **not** a Node-RED plugin: there is no `node-red` field or dependency here. The plugin is
**node-red-contrib-mikronode-ng** (`~/repos/_mine/node-red-contrib-mikronode-ng`, branch `develop`), which
depends on this library. Keep this library generic; Node-RED-specific code belongs in the plugin.

## Commands

- `npm run lint` - ESLint, flat config in `eslint.config.js`.
- `npm run documentation` - JSDoc into `doc/` (git-ignored, no longer committed).
- `node examples/<name>.js <host> <user> <password> [...]` - examples against a real device; there is
  no automated test suite (`npm test` is a stub, `test/test1.js` is a legacy manual script).

## Architecture

- `lib/index.js` - entry point: `getConnection(host, user, password, options)`, `parseItems`,
  `Connection`, `Channel`.
- `lib/connection.js` - socket, sentence parser, login state machine, channel management, reconnect.
- `lib/channel.js` - one tagged command stream; emits `data`/`read`/`done`/`trap`/`error`, with the
  channel itself as the 2nd argument so consumers can read `channel.id`.
- `lib/trap.js`, `lib/utils.js` - trap/error types and helpers. Private state uses `private-parts` (`_(this)`).
- Object-form params are **not** auto-prefixed with `=`: write `{'=interface': 'ether1'}`, otherwise
  RouterOS traps with "missing =interface=".

## Design decisions (agreed with the user)

- **One Connection, one Channel per feature.** `openChannel()` supports many concurrent channels; use named
  channels (`openChannel('traffic')`, `'wifi-reg'`, `'routes'`). Reference: `examples/monitorMultipleWithReconnect.js`.
- **No envelope wrapping in `lib/`.** The plugin maps `channel.id` -> `msg.topic` and parsed data ->
  `msg.payload` (Node-RED convention).
- **Channels are per feature, not per resource.** `/interface/monitor-traffic` takes `=interface=ether1,ether2`
  in one command and each row carries its own `name`.
- **Reconnect is opt-in:** `options.reconnect` (`true` or `{retries, delay, maxDelay, factor}`, exponential
  backoff) with `reconnecting`/`reconnected` events. Channels do not survive a reconnect; reopen them in
  the `reconnected` handler. On reconnect the sentence-parser state (`currentChannelId`, `currentReply`,
  buffers) must be reset or the next login gets corrupted.

## Examples

`examples/` doubles as the debugging reference for the plugin's nodes: each `monitor*.js` mirrors one
plugin node so a RouterOS upgrade can be checked against the API layer on its own, without Node-RED.
Keep them in step with the plugin (`monitorTraffic`, `monitorRoutes`, `monitorWifiRegistration`,
`monitorOvpnClient`, `monitorLog`, `getInformation`, ...).

## History

- **Up to 1.0.11** - upstream (gtjoseph) work: trap clearing, `closeOnDone` with multiple channels, keepalive delay.
- **2026-08 (pre-1.1.0)** - `lib/` passes eslint, docs updated, new examples.
- **`ac0ccde` (2026-08-26)** - disconnect detection + reconnect. `lib/connection.js` never listened for the
  socket's `close` event, so a clean device-side disconnect went unnoticed. Added the `reconnect` option
  and events, and the parser-state reset. (The commit message, "Added new example
  monitorMultipleWithReconnect", undersells it.)
- **1.1.0 (2026-08-28, PR #1)** - LICENSE, Readme, generated `doc/` removed from the repo.
- **1.2.0 (2026-08-29)** - RouterOS 7.x only.
- **1.3.0 (2026-08-29)** - `error` events when running commands; number parsing changed.
- **1.4.0 (2026-08-29)** - examples reworked to match node-red-contrib-mikronode-ng; minor fixes.
- **After 1.4.0** - `examples/monitorLog.js`: `/log/print` with `=follow-only=` (new entries only, default)
  or `=follow=` (history, then new entries). Never sends `done`, so it turns `saveBuffer` off in the write
  callback. The other `monitor*.js` examples likely need the same.
- **Named channels fixed (after 1.4.0)** - `Connection.sentence()` only passed `!re` rows to a channel when
  `currentChannelId >= 0`, so a named channel (`openChannel('log')`) never got `read`/`data` events (only
  `done`). It now checks that the channel exists. Before this, every example used unnamed (numeric) channels.

## Long-running commands

`Channel.saveBuffer` (default on, re-enabled by every `write()`) keeps each row until `done`. Commands that
never finish (`follow`, `monitor-traffic`, `listen`, `=interval=`) must set `ch.saveBuffer = false` in the
write callback, or memory grows for as long as they run.

## Branches and releases

Work on `develop`, merge to `main` for releases, tag `vX.Y.Z`. Commit only when the user asks.

## Local files

`tmp/` is git-ignored and holds the user's planning notes (`tmp/node-red-plugin-checklist.md`,
`tmp/features_functions.MD`). Its checkboxes are out of date; ask the user what's actually done.
Don't commit or reorganise it.
