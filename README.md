# Vice Fieldnotes

[![make.fun competition](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![make.fun rank](https://make.fun/badge/gta6-trophy-guide-01/RenaldiRenaldi/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![make.fun reward](https://make.fun/badge/gta6-trophy-guide-01/RenaldiRenaldi/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An independent GTA VI trophy field guide and browser tracker for [the make.fun bounty](https://make.fun/bounty/gta6-trophy-guide-01). All 55 kit-listed PS5 trophies retain their exact names, descriptions and grades. Original cited guidance, a five-stage platinum route, qualified missable precautions and portable progress sit inside a light field-notes interface. No Rockstar imagery, runtime dependencies, telemetry or remote runtime requests.

## Open and use

Run `node serve.ts`, then open `http://127.0.0.1:8080`. Node 22.18+ is sufficient. Any static server can serve `app/`; no build or installation is needed. Offline means no network beyond the local static server. Source links open only when clicked.

Select a trophy, filter by kind/grade/status or search. Story details stay concealed until earned unless spoilers are enabled. Checkboxes, counters, bookmarks, notes and roadmap tasks persist locally. Export a JSON backup to move progress between browsers; imports are validated before replacement. Demo progress is explicitly labelled and opt-in. A counter reaching its target never claims a PS5 unlock automatically.

## Evidence and limits

The guide contains 220 numbered steps across all 55 trophies. Browser verification counts **475 actually displayed citation markers**, averaging **2.16 per step**; **187/220 steps (85%)** have at least two. A step displays only its explicitly assigned sources; trophy-level sources never inflate its citation count. Thirty-six distinct source URLs and twelve qualified source differences remain available. Some differences compare trophy thresholds with separate 100% targets or incomplete guide coverage; they are not all contradictory unlock methods.

The source register retains individual check dates and access results. Thirty-four pages were read in the recorded research pass; GTA BOOM and GTA Wiki retain earlier successful-read provenance and explicitly unsuccessful rechecks. Exophase became accessible through the web reader after its earlier HTTP 403. No source report implies personal gameplay verification.

The kit's starter data contains names, descriptions and grades but **no individual hidden flags**, despite the rules describing them. The 28 per-trophy flags therefore follow Output Lag's explicit hidden list, corroborated by GTABase; this limitation is stated in the app. Hidden status is separate from the story-spoiler preference.

Positive Mental Attitude remains a potential missable, not a proven lockout. Its Chapter 1 opportunity disappears, while the requirement for that opportunity is unconfirmed. Research Hold keeps all three rechecked cards: In The Beginning… and Ten Pin have source-reported methods; Bad Luck, I Guess remains unresolved. Fair Game's precise triggering animal is also unconfirmed. The TROPHY ≠ 100% table, NEXT UP, stage counters and all 55 roadmap chips preserve the route's distinction between trophy and completion targets. Stage-hour estimates overlap rather than add together.

## Verification and captures

`scripts/verify.mjs` uses an existing Playwright installation and cached Chromium. Set `PLAYWRIGHT_MODULE` to its local module URL, `CHROME_PATH` to cached Chromium, and `APP_URL` to the served app. Run `node scripts/verify.mjs`. It checks every rendered step's exact citation markers, all trophy flags, source/dispute totals, the computed audit, backup round trips, rejected imports, persistence, spoiler protection, all routes, mobile overflow, external requests and screenshot dimensions/bytes.

The kit measures static first load as index HTML, its stylesheet and static JavaScript imports, summing each file's gzip-9 size: **16,157 bytes**, confirmed with the kit's own dependency walk. Secondary route templates/styles load only on navigation. The trophy JSON is fetched separately and compresses to **14,745 bytes**. Verification enforces the 16,384-byte cap on both the static set and the data file. Their combined compressed browser payload is 30,902 bytes; the static figure is the kit metric, not a claim that the complete tracker transfers in 16 KiB.

Set `CAPTURE_SHOTS=1,2,3,4` to capture the four views declared in `shots.json`. Capture uses cached Chromium's headless `--screenshot` command with a CDP-controlled real demo-backup import. Shot 2 includes the actual import toast. All four old JPEGs decoded cleanly; apparent green banding was a JPEG viewer artifact. Their obsolete 142-step audit and inflated citation average made them stale evidence, so all four were recaptured. Each image is at most 1280 pixels on its long side and 256 KiB. PNG inspection derivatives and enlarged crops are review aids, not delivered screenshots.

`MAKEFUN_OUTPUT_DIR=out node main.ts` is the existing packaging entrypoint for the parent to run. This repair session builds, verifies, commits and pushes only; it does not seal or submit. The unchanged kit dossier library remains in `vendor/makefun-frontend.ts`.

MIT for original code and guidance. Official trophy metadata belongs to its respective owners. Independent fan project with no Rockstar or PlayStation affiliation. The signed freshness anchor and `.makefun/owner.json` remain present.
