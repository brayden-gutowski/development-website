# Website memory and optimization audit

Goal: find and fix accumulating memory/resources, remove verified duplication and unnecessary work, and preserve the site's existing content, media quality, appearance, and interactions.

Approach: audit ownership in each production module, measure the current site under repeated visits, reproduce new findings before fixing them, then compare the same workload after changes. Keep the existing uncommitted fourth-book and album additions. Work in the current checkout so those additions are included in the audit. No dependency additions or publication.

- [x] Record a 30-cycle baseline: XP windows, room/globe visits, diary and four review books; collect heap after GC, DOM/listeners, GPU counters and inactive-room residency.
- [x] Review globe/navigation/flight, rooms/GPU/image residency, readers/print textures, XP/audio/media and retained diagnostics. Distinguish intentional bounded caches from accumulating resources.
- [x] Reproduce actionable findings with narrow regressions; fix at each resource's owner. Consolidate duplicate logic only after tracing all callers.
- [x] Run unit tests, failure/retry/lifetime regressions, affected visual/mobile checks, and repeat the 30-cycle soak plus normal-flight coverage.
- [x] Review the final diff, record measured results and verification limits in `docs/performance/2026-11-03-memory-audit.md`.

Review focus: partial asynchronous failures; dispose/suspend while preparation is pending; repeated viewport resize and reader reopening; repeated room swaps and XP window operations; hidden media and abandoned pointer interactions.

Progress and evidence are recorded below as the audit proceeds.

Baseline: 30 cycles passed; textures 98, geometries 113, nodes 1,666, listeners 173. New regression evidence and fixes are described in the performance report. Independent read-only code review found no actionable issues. Full browser verification completed; the CRT passive-size check now waits for the rendered camera state, and mobile discovery expects the newly added fourth book when wrapping backward.

Final: 16/16 Node checks and 58/58 maintained browser checks passed, as did matching 30-cycle before/after measurements and four normal-flight cycles. Raw reports and limits are saved with the performance report. Source/media quality is preserved and no dependency was added. Review complete in the local checkout; commit and push are handled separately at the user’s request.
