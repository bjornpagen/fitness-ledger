# Public source catalog

This directory contains redistributable metadata and canonical references, not third-party full-text binaries. The catalogs describe the corpus used in the audits; they do not establish which files are present in a particular checkout. Supplied originals belong under ignored `private/sources/`.

- [EVIDENCE_CATALOG.md](EVIDENCE_CATALOG.md) lists the scientific evidence and important limitations.
- [BAYE_CATALOG.md](BAYE_CATALOG.md) lists the purchased primary texts used by the Baye audits.
- HOIST owner's manuals and archived product pages are cited, with page numbers, in [the machine guide](../docs/program/Gym_Machine_Guide.md) and in `hoistSources` in `src/policy/equipment.ts`.
- Public conclusions and pinpoint citations live under `docs/research/`.

`pnpm sources:extract-text` reads the private corpus and writes disposable page-delimited text under `private/generated/text/`. Generated text is never a second canonical source.
