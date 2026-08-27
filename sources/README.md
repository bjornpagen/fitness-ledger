# Public source catalog

This directory contains redistributable metadata and canonical references, not third-party full-text binaries. The complete working corpus is preserved separately under ignored `private/sources/` and can be restored beside a clone for an authorized local assistant.

- [EVIDENCE_CATALOG.md](EVIDENCE_CATALOG.md) lists the scientific evidence and important limitations.
- [BAYE_CATALOG.md](BAYE_CATALOG.md) lists the purchased primary texts used by the Baye audits.
- Public conclusions and pinpoint citations live under `docs/research/`.

`pnpm sources:extract-text` reads the private corpus and writes disposable page-delimited text under `private/generated/text/`. Generated text is never a second canonical source.
