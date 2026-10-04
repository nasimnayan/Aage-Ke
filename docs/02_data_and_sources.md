# 02 · Data and sources

## 1. Data we build with

| File | What | Source | Licence | Used for |
|---|---|---|---|---|
| `data/train_sentences.csv` | 400 to 600 constructed messages | Drafted by Claude, verified by Nasim (`verified` column) | Ours, CC BY 4.0 | Training + dev split |
| `data/raw/vashantor/` | 32,500 general sentences, 5 regional dialects, Bangla and Banglish | Vashantor, Mendeley Data 10.17632/bj5jgk878b.2 | **Cowork checks** | Official train split → "no warning sign" negatives. Official test split → false-alarm test by dialect. Skip entirely if licence does not allow. |
| `labels_dengue.json` | Fixed list, cues, negation and past words | Signs from WHO 2009 / CDC 2024 warning signs, Bangla by Nasim | Ours | Model labels, keyword baseline, rules |
| `data/facilities_nazirpur.json` | 4 to 8 facilities with coordinates | healthsites.io or OpenStreetMap (Cowork) | ODbL | Facility card |

`train_sentences.csv` columns:
`text, labels, script, dialect, is_negated, is_past, source, verified`
- `labels`: pipe-separated keys, empty for "none"
- `script`: `bn` | `banglish` | `mixed`
- `source`: `claude_draft` | `vashantor_neg` | `nasim`

Synthetic data is allowed by the brief if labelled. Every constructed row says `claude_draft`.

## 2. Test sets (never trained on, never used to tune)

| File | Rows | Who writes | Columns |
|---|---|---|---|
| `data/test_t1_human.csv` | 17 | **Real messages from 4 volunteers in 4 districts** (Chandpur, Satkhira, Munshiganj, Pabna), written in their own words to the WhatsApp prompt below. Text untouched; labels proposed by Claude, checked by Nasim | `text, labels, script, dialect, is_negated, is_past, district` |
| `data/test_t2_crowd.csv` | 6 (C05, Dhaka) | Later WhatsApp replies (same prompt), added as they arrive | same + `scenario_id`, `contributor_id` (C01, C02, no names) |
| `data/test_challenge_synthetic.csv` | 33 | **Synthetic**, written by Claude: misspellings, mixed English, negation, past, hard negatives, 8 dialect probes (Chittagonian, Sylheti, Noakhali, Barishali; `verified=false`). Used for Gate 1 only and reported separately as a stress test, **never as human evidence** | `text, labels, script, dialect, is_negated, is_past, expected_outcome, source, verified, note` |
| `data/test_t3_real.csv` | 80 | Bangla Healthcare Severity Dataset posts, Claude proposes labels, Nasim verifies | same + `orig_category`, `label_source` = `claude_proposed_nasim_verified` |

T3 selection: Cowork found only 1 of 5,263 posts mentions dengue, 215 mention fever, 29 mention fever plus a warning sign. So: take all 29, add 21 posts that match any warning-sign cue without fever, and 30 random posts from other topics (false alarms). **README must say T3 tests general warning-sign wording in real posts, not dengue follow-up messages.** Use the XLSX-derived UTF-8 CSV; the Mendeley CSV is broken (Bangla saved as ?).
Also run the model over all 5,263 posts and report, per original severity class, the share of posts that get at least one confident warning label. Descriptive only.

### WhatsApp prompt used for T2 (keep verbatim for the README)

> একটা ছোট সাহায্য চাই, ২ মিনিট লাগবে। ধরুন আপনার পরিবারের কেউ ডেঙ্গু নিয়ে বাসায় আছেন। গ্রামের স্বাস্থ্যকর্মী আপা বলেছেন, রোজ SMS করে জানাতে। নিচের প্রতিটা অবস্থায় আপনি আপাকে কী লিখতেন? আমার শব্দগুলো কপি করবেন না। আপনি আসলে যেভাবে লেখেন, সেভাবে লিখুন: বাংলায় হোক বা ইংরেজি অক্ষরে, নিজের এলাকার ভাষায়। বানান ভুল হলেও সমস্যা নেই।
> ১. পেটে খুব ব্যথা ২. কয়েকবার বমি ৩. মাড়ি বা নাক দিয়ে রক্ত ৪. জ্বর নেমে গেছে, এখন ভালো আছে ৫. গতকাল বমি হয়েছিল, আজ হয়নি ৬. খুব নেতিয়ে পড়েছে, কিছু খেতে পারছে না ৭. কেমন যেন করছে, ঠিক বোঝাতে পারছেন না
> শেষে লিখুন আপনি কোন জেলার মানুষ। আপনার নাম কোথাও যাবে না। লেখাগুলো একটা খোলা hackathon প্রজেক্টে শুধু পরীক্ষার জন্য ব্যবহার হবে।

Expected labels by scenario: 1 `abdominal_pain` · 2 `persistent_vomiting` · 3 `bleeding` · 4 `fever_dropped|feeling_better` · 5 `persistent_vomiting` with `is_past=1` (correct outcome = not sure) · 6 `lethargy_restless|cannot_drink` · 7 none (correct outcome = did not understand).
Nasim checks every row; if a contributor wrote something different from the scenario, label what they wrote.
Known bias: the scenario wording may prime contributors. Rows that copy the prompt wording get `primed=1`.
**Integrity rule:** nothing from T2 or T3 goes into training data or cues. The v0.3 rule fixes were made after reading contributors C01 to C04 (now in T1), so their rows carry `seen_before_rule_fix=1`; T2 rows that arrive later are fully unseen, so report T1 and T2 separately and pooled. Extra columns in T1 and T2: `primed, seen_before_rule_fix, expected_outcome, label_note, verified`.

## 3. Every number and its link

Checked by Cowork on 4 Oct 2026 (full notes in `data/incoming/02_sources_filled.md`).
Status: **P** = primary source opened · **S** = secondary (news citing the source).

| # | Claim (use this wording) | Link | Status |
|---|---|---|---|
| 1 | 84,369 admitted and 256 deaths in 2026 to 3 Oct; 64,954 admissions and 153 deaths outside city corporations; women 37.6% of admissions, 51.2% of deaths; September 43,774 admissions, 148 deaths | DGHS HEOC daily dengue press release, 3 Oct 2026: https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php (PDF in project files) | P |
| 2 | **In DGHS's 2025 death review, 66 of 114 reviewed deaths happened within 24 hours of admission** (18 within 24 to 48 h, 5 within 48 to 72 h, 25 after 72 h). Officials named late arrival as the main cause. **This is 2025, not 2026.** | https://www.thedailystar.net/health/disease/news/late-admission-leading-cause-dengue-deaths-3992161 (DGHS press conference, 22 Sep 2025) | S. No DGHS primary document found. bdnews24 says 124 reviewed; Daily Star's 114 matches the breakdown, so use 114. |
| 3 | WHO: ambulatory (Group A) patients "should be reviewed daily for disease progression ... until they are out of the critical period" | WHO 2009 guideline, section 2.3.2.1, printed page 34: https://www.who.int/publications/i/item/9789241547871 · CDC Dengue Pocket Guide 2024: https://cdc.gov/dengue/media/pdfs/342849-A_Dengue_PocketGuide_UPDATE_2024.pdf | P |
| 4 | DengueAid (Malaysia) patient self-monitoring app: 63% of approached patients refused to join (62 of 99) | Digital Health 2024, doi 10.1177/20552076241277710, PMC11378219 | P (abstract) |
| 5 | Outpatients' knowledge of warning signs was inadequate even after physicians explained them | PLoS NTD 2023: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10168551/ | P (abstract) |
| 6 | 98.9% of households own a mobile phone; 63.2% of men and 52.8% of women own one themselves (age 5+, BBS ICT Access and Use Survey 2025-26, Q1) | BBS report listed on https://bbs.gov.bd/pages/static-pages/6922e012933eb65569e25543 (pages 4 and 7) | P |
| 7 | One CHCP runs each community clinic, for about 6,000 people within half an hour's walk; about 38 visits per clinic per day (older sources, 2017 and 2019) | https://ijic.org/articles/10.5334/ijic.3693 · https://unsouthsouth.org/?p=2947 | S |
| 8 | DHIS2 used in more than 14,000 community clinics (by 2022). **Do not say "largest implementer".** | https://dhis2.org/?p=23395 | P |
| 9 | Among patients reaching a tertiary hospital, informal providers were the most common first contact (46.2%) | JBCPS 44(3), 2026: https://banglajol.info/index.php/JBCPS/article/view/91557 | P (abstract) |
| 10 | In September 2025, DGHS directed government hospitals to run separate dengue wards and teams | Daily Star link in #2 | S, date it 2025 |
| 11 | Pirojpur: 1,159 cases 1 Jan to 16 Aug 2026 vs 477 same period 2025; WHO listed it among six districts with a marked rise; no Barguna-style mosquito control there | Prothom Alo, 17 Aug 2026: https://www.prothomalo.com/bangladesh/958doqb1hj | S |
| 12 | Coastal districts (Barguna, Jhalokati, Pirojpur) had more Aedes larvae; salinity leads families to store rainwater year-round | BBC Bangla, 20 Aug 2026: https://www.bbc.com/bengali/articles/cqx7n9elw2yo | S |

**Do not use:** handoff numbers 239 deaths and 73,694 cases (stale) · Khatun et al. phone ownership (old) · speech recognition word error rates (not checked) · `dataset.csv` and the Jamalpur hematology dataset (lab diagnosis data, out of bounds for the health track).

## 4. What our data does not cover (README must list this)

- Real patient messages. None were used.
- Messages from people with very low literacy. T3 comes from Facebook and YouTube users, who are more connected than Noor.
- Dialects we could not verify. Name them from the T2 district list. Chittagonian and Sylheti are likely weakest.
- Chakma, Marma and other minority languages. Not covered at all.
- Voice. The tool reads text only.
- Children as patients, pregnancy, co-infections.
- How often families actually reply, and SMS delivery failures.
- Facility admission status is assumed from a DGHS directive unless confirmed.
- Travel time. We show straight-line distance only.
