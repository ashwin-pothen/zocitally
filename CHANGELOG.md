# Changelog

## 0.3.0

- Fixed a crash on quit (Cmd+Q): plugin cleanup was skipped on full application shutdown, leaving the preference pane and database connection registered when Zotero began tearing down windows. Cleanup now always runs, defensively, regardless of shutdown reason.
- Fixed a related issue where quitting mid-update could leave Zotero unresponsive: citation fetch retries now stop immediately on shutdown instead of working through their full backoff schedule, and the shutdown wait is capped at 35 seconds as a backstop.
- Removed the stale-value amber coloring and the "Refresh interval" setting; the sortable **Citations Updated** column already surfaces staleness without it, and nothing in the plugin re-fetches automatically based on age.
- Added an application icon, shown in the Add-ons manager and next to the plugin's entry in Zotero's settings sidebar.
- Removed a duplicated "Zocitally" heading on the settings pane.
- Added `DEVELOPMENT.md` documenting the above and a Zotero testing gotcha (a rebuilt `.xpi` needs a full quit-and-relaunch, not just a reinstall, to take effect).

## 0.2.0

- Added a sortable **Citations Updated** column showing when each item's count was last fetched from OpenAlex, so it's easy to see what's due for a refresh.
- Citations and Citations Updated cells now render in amber once a value is older than the configured refresh interval.
- Removed `node_modules` and `build/` from version control.

## 0.1.0

- Initial public release of Zocitally.
- OpenAlex citation counts in a sortable Zotero **Citations** column.
- Local cache, manual and conservative automatic updates, preferences, progress, and retry handling.

Built with assistance from Claude. Zocitally remains an independent community project and is not affiliated with or endorsed by Anthropic.
