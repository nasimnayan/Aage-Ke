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
| `data/test_t1_human.csv` | 30 to 60 | Nasim, before seeing training data | `text, labels, script, dialect, is_negated, is_past, district` |
| `data/test_t2_crowd.csv` | 60 to 90 | People from different districts via WhatsApp | same + `scenario_id`, `contributor_id` (C01, C02, no names) |
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
**Integrity rule:** nothing from T2 or T3 goes into training data or cues. The v0.3 rule fixes were made after reading contributors C01 to C04, so their rows carry `seen_before_rule_fix=1`; report T2 twice, with and without those rows. Extra columns in T2: `primed, seen_before_rule_fix, expected_outcome, label_note, verified`.

## 3. Every number and its link

Status: **P** = primary source opened · **S** = secondary (news citing the source), open the primary before the video.

| # | Claim | Link | Status |
|---|---|---|---|
| 1 | 84,369 admitted, 256 deaths in 2026 to 3 Oct; 64,954 admissions and 153 deaths outside city corporations; women 37.6% of admissions, 51.2% of deaths; September 43,774 admissions, 148 deaths | DGHS HEOC daily dengue press release, 3 Oct 2026: https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php (PDF in project files) | P |
| 2 | DGHS 2026 death review: 66 died within 24 h of admission, 18 within 24 to 48 h, 5 within 48 to 72 h, 25 after 72 h. Officials blame late arrival | https://bdnews24.com/health/38962c12a083 and https://asianews.network/late-admission-leading-cause-of-dengue-deaths-in-bangladesh | S. **Mismatch:** 124 reviewed, breakdown sums to 114. Use "66 within 24 hours" only. |
| 3 | Group A patients managed at home need daily review until out of the critical phase | WHO 2009 guideline https://www.who.int/publications/i/item/9789241547871 · CDC Dengue Pocket Guide 2024 https://cdc.gov/dengue/media/pdfs/342849-A_Dengue_PocketGuide_UPDATE_2024.pdf | CDC P, WHO open before video |
| 4 | DengueAid (Malaysia) patient self-monitoring app: 63% of approached patients refused to join | https://eprints.um.edu.my/47100 (Digital Health 2024, doi 10.1177/20552076241277710) | P (abstract) |
| 5 | Outpatients' knowledge of warning signs was inadequate even after physicians explained them | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10168551/ | P |
| 6 | 98.9% of households own a mobile; 63.2% of men and 52.8% of women own one themselves (BBS ICT Access and Use Survey 2025-26, Q1) | https://www.bssnews.net/news/343905 | S, Cowork finds the BBS report |
| 7 | One CHCP per community clinic, about 6,000 people within half an hour's walk; about 38 visits per clinic per day | https://refworks.reference-global.com/article/10.5334/ijic.3693 · https://unsouthsouth.org/?p=2947 | S |
| 8 | DHIS2 used in more than 14,000 community clinics; Bangladesh the largest DHIS2 implementer | https://dhis2.org/?p=23395 | P |
| 9 | Informal providers were the most common first contact (46.2%) in a 2026 study | https://banglajol.info/index.php/JBCPS/article/view/91557 | P (abstract) |
| 10 | DGHS directed all government hospitals to run separate dengue wards and teams | asianews.network link in #2 | S |
| 11 | Pirojpur: 1,159 cases 1 Jan to 16 Aug 2026 vs 477 same period 2025; WHO lists it among six districts with a marked rise; little mosquito control there | Prothom Alo, 17 Aug 2026 (PDF in project files) | Cowork finds URL |
| 12 | Coastal districts (Barguna, Jhalokati, Pirojpur) had more Aedes larvae; rainwater stored because of salinity | BBC Bangla, 20 Aug 2026 (PDF in project files) | Cowork finds URL |

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
