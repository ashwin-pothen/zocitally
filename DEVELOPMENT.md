# Development notes

Notes for anyone working on this repository: known issues that were hard to
diagnose, why the current code looks the way it does in a few places, and a
testing gotcha that produced misleading results more than once.

## Testing gotcha: reinstalling over a running Zotero gives stale results

Installing a rebuilt `.xpi` over an already-loaded version of the plugin
(Tools → Add-ons → Install Add-on From File, without fully quitting Zotero
first) does not reliably reload the plugin's code. Symptoms seen from this:

- The settings pane appears in the sidebar list but does nothing when clicked.
- A bug that was just fixed still reproduces identically, because Zotero is
  still running the old code.

**Always fully quit Zotero (not just close the window) and relaunch before
trusting a test result**, especially when testing anything in `bootstrap.ts`'s
`startup`/`shutdown` lifecycle.

## Crash on quit (Cmd+Q / full app shutdown)

Zocitally previously caused Zotero to crash (`EXC_BAD_ACCESS` / `SIGSEGV`,
native, no JS stack) on a full application quit, reproducing on every quit
with the plugin installed and never with it removed.

Root cause: `bootstrap.ts`'s `shutdown()` had an early return —
`if (reason === APP_SHUTDOWN || !runtime) return;` — that is a common pattern
in Zotero plugin templates (the reasoning being "the process is about to die,
don't bother"). In practice this meant `PreferencePanes.unregister()`,
`storage.close()`, and every other cleanup call **never ran on Cmd+Q**, so the
plugin's preference pane (which Zotero hosts in a `<browser>` element) and its
SQLite connection were left dangling right up until Gecko began tearing down
windows. That is the current best explanation, based on:

- The crash trace being deep, unsymbolicated native `XUL` frames with a
  recursive pattern (same frames repeating twice), consistent with a teardown
  observer chain re-entering itself.
- A JS-level error seen once before the fix, in the same area:
  `TypeError: this.ownerGlobal.gBrowser.getTabForBrowser is not a function`
  at `onPageHide` in `browser-custom-element.mjs` — fired when a `<browser>`
  element's content is torn down.

It was **not** proven definitively (the native stack has no symbols), but
removing the early return and always running cleanup — wrapped in a small
`guard()` helper so one failing step can't block the rest, particularly
`storage.close()` — resolved it across repeated testing.

If this ever regresses: get the actual macOS crash report, not just Zotero's
JS debug output. It's at `~/Library/Logs/DiagnosticReports/Zotero_*.ips`, or
via Console.app → Crash Reports. A JS-catchable error would show a stack with
function names; a blank/offsets-only native stack like this one means it's a
segfault below the JS layer, which the JS debug log alone won't reveal.

## Shutdown could hang waiting on network retries

Separately from the crash above: `updater.shutdown()` waits for any in-flight
`update()` call to finish, so `storage.close()` never races an in-flight DB
write. The first version of that wait had no bound. `OpenAlexClient`'s retry
logic (`requestWithRetry`) retries transient failures (429/5xx/network
errors) up to 3 times with exponential backoff, up to 30s, with no awareness
of shutdown — so quitting mid-batch-update while OpenAlex was erratic could
make Zotero sit unresponsive for minutes, easily read as a hang requiring a
force-quit.

Fixed by threading an `isCancelled()` check into `requestWithRetry` (stop
retrying immediately once shutting down, no more backoff sleeps) and adding a
hard ceiling (`SHUTDOWN_MAX_WAIT_MS`, 35s) on the shutdown wait as a backstop.
See the test in `tests/openalex.test.ts` asserting retries stop and no sleep
happens once cancelled — that's the regression guard for this specific class
of bug.
