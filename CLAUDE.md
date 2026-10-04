# CLAUDE.md · Aage Ke? (আগে কে?)

Hackathon entry: World Bank × Hack-Nation, Challenge 04a Small AI for Development, Health.
**Deadline 19:00 Asia/Dhaka, 4 Oct 2026.** Feature freeze 15:30.

## Read first, in this order
1. `docs/00_START_HERE.md` (decisions, timeline, gates)
2. `docs/01_solution_design.md` (what to build)
3. `docs/03_claude_code_tasks.md` (your task list CC1 to CC9, with acceptance checks)
4. `data/labels_dengue.json` (fixed label list and rules, must be version 0.3)
Read `docs/02_data_and_sources.md` before CC8 and CC9.

## Folder rules
- Read only `data/` and `data/raw/`. **Never read or use `data/incoming/`.** Nasim moves files out of it after checking them.
- Training data: `data/train_sentences.csv` only.
- Test sets: `data/test_t1_human.csv`, `data/test_t2_crowd.csv`, later `data/test_t3_real.csv`. **Never train, tune thresholds or add cues from any test set.**
- `data/raw/bangla_healthcare_severity.csv` is only for the descriptive run in CC8 and for building T3 with Nasim. Never train on it.
- Do not edit `docs/` or `data/labels_dengue.json`. If something in them is wrong, stop and tell Nasim.

## Working rules
- Do tasks in order. After each acceptance check, stop and report in 3 lines: done / result / next.
- Gate 1: as soon as `data/test_t1_human.csv` has rows, run `model/evaluate.py --quick` and report keyword vs keyword+neg vs model+rules.
- No features beyond `docs/03_claude_code_tasks.md`. Ideas go to `NEXT_STEPS.md`.
- Plain HTML + vanilla JS for the app. No framework, no build step, no runtime CDN, no LLM, no network calls.
- Facility phone numbers are real. In judge mode mask them and disable tel:/sms: links.
- No AI-written text ever goes to a patient. SMS text comes only from `app/templates.json`.
- No diagnosis words in the UI or SMS. No employer name anywhere.
- British English in README and code comments. Bangla UI strings come from the docs; do not invent new Bangla text, ask Nasim.
