# Changelog

## 0.2.0

- Added a sortable **Citations Updated** column showing when each item's count was last fetched from OpenAlex, so it's easy to see what's due for a refresh.
- Citations and Citations Updated cells now render in amber once a value is older than the configured refresh interval.
- Removed `node_modules` and `build/` from version control.

## 0.1.0

- Initial public release of Zocitally.
- OpenAlex citation counts in a sortable Zotero **Citations** column.
- Local cache, manual and conservative automatic updates, preferences, progress, and retry handling.

Built with assistance from Claude. Zocitally remains an independent community project and is not affiliated with or endorsed by Anthropic.
