# Aage Ke? (আগে কে?) — "Who first?"

**An offline phone tool that tells a community health worker, the same day, which of her home-managed dengue patients has reported a warning sign, so the family reaches hospital before it is too late.**

**Try it:** https://nasimmahmudnayan.com/Aage-Ke/ (works offline after the first load)

**Videos:** team intro · product demo · technical walkthrough (links added after upload)

Hack-Nation × World Bank · Challenge 04a, Small AI for Development · Health

> **AI reads. Code does everything else. A person decides.**

### The 60-second judge path

1. Open the link and tap **ডেমো দেখুন (Try the demo)**. Six fictional patients load, in English. Use the **বাংলা | English** switch (top right) at any time.
2. The list is already sorted **red / amber / green**. Tap **P-01 Noor** (red). Her family wrote *"pet e khub betha, 2 bar bomi korse"*: the model suggested *severe abdominal pain* and *persistent vomiting*, and the health worker confirmed both.
3. Tap **Refer**. The app picks the nearest hospital that admits dengue patients (Nazirpur Upazila Health Complex, 3.2 km in a straight line), fills a referral note and a pre-written SMS, and masks the real phone number because this is a demo.
4. Go back and open **P-02** ("pet betha nai, valo achi", *no stomach pain, I am well*): negation is handled, so no warning sign. **P-03** ("kal bomi hoisilo aj nai", *vomited yesterday, not today*) is past tense, so the model says **not sure** and leaves it to a person. **P-05** ("kemon jani kortese") is not understood, so it says **call them**.
5. Tap **Add message** on any patient and type your own message, in Bangla or Banglish. Each label shows **Why** (the words that drove it), and the line at the top shows the model size and how long it took to read (under a millisecond on a laptop).

---

## 1. Problem and user

### Why people die: they reach hospital too late

Most people with dengue are cared for at home. The **World Health Organization** says home-managed (Group A) patients *"should be reviewed daily for disease progression ... until they are out of the critical period"* ([WHO 2009 guideline, section 2.3.2.1, page 34](https://www.who.int/publications/i/item/9789241547871); also the [CDC Dengue Pocket Guide 2024](https://cdc.gov/dengue/media/pdfs/342849-A_Dengue_PocketGuide_UPDATE_2024.pdf)). Warning signs tend to appear around the time the fever falls, exactly when families think the patient is getting better and stop reporting.

In rural Bangladesh nobody does that daily review. The evidence that this gap costs lives:

| What we know | Source |
|---|---|
| **In DGHS's 2025 death review, 66 of 114 reviewed deaths happened within 24 hours of admission** (18 within 24 to 48 h, 5 within 48 to 72 h, 25 after 72 h). Officials named late arrival at hospital as the main cause. | [The Daily Star, DGHS press conference, 22 Sep 2025](https://www.thedailystar.net/health/disease/news/late-admission-leading-cause-dengue-deaths-3992161) (secondary; no DGHS primary document was found) |
| 2026, up to 3 October: **84,369 admitted and 256 deaths**; 64,954 admissions and 153 deaths outside city corporations; women 37.6% of admissions but 51.2% of deaths; September alone 43,774 admissions and 148 deaths | [DGHS HEOC daily dengue press release, 3 Oct 2026](https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php) |
| Pirojpur: 1,159 cases from 1 January to 16 August 2026 against 477 in the same period of 2025; WHO listed it among six districts with a marked rise | [Prothom Alo, 17 Aug 2026](https://www.prothomalo.com/bangladesh/958doqb1hj) (secondary) |
| Coastal districts (Barguna, Jhalokati, Pirojpur) had more *Aedes* larvae; salinity leads families to store rainwater all year | [BBC Bangla, 20 Aug 2026](https://www.bbc.com/bengali/articles/cqx7n9elw2yo) (secondary) |
| Among patients reaching a tertiary hospital, informal providers were the most common first contact (46.2%) | [JBCPS 44(3), 2026](https://banglajol.info/index.php/JBCPS/article/view/91557) |
| Outpatients' knowledge of warning signs stayed inadequate even after physicians explained them | [PLoS NTD 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10168551/) |
| A patient self-monitoring app in Malaysia: 63% of approached patients refused to join (62 of 99) — so the tool must not depend on the patient installing anything | [Digital Health 2024, PMC11378219](https://doi.org/10.1177/20552076241277710) |

**Problem statement.** Because of this tool, a community health worker will know the same day which of her dengue patients at home has reported a warning sign after the fever falls, which she would otherwise learn about only when the family reaches hospital too late; we know because WHO advises daily review of home-managed dengue patients until the critical phase ends, and in DGHS's 2025 dengue death review, 66 of 114 reviewed deaths happened within 24 hours of admission.

### The one user, and the person served

- **Rina (fictional)** is the Community Health Care Provider (CHCP) at a community clinic in **Nazirpur upazila, Pirojpur**. One CHCP runs each community clinic, for about 6,000 people within half an hour's walk ([IJIC](https://ijic.org/articles/10.5334/ijic.3693), [UNOSSC](https://unsouthsouth.org/?p=2947); older sources, 2017 and 2019). She has an Android phone, patchy data and a busy clinic. Community clinics already record services in DHIS2: more than 14,000 of them by 2022 ([DHIS2](https://dhis2.org/?p=23395)).
- **Noor** is the person served. She has a basic phone. 98.9% of households own a mobile phone, but only 52.8% of women and 63.2% of men own one themselves ([BBS ICT Access and Use Survey 2025-26, Q1](https://bbs.gov.bd/pages/static-pages/6922e012933eb65569e25543)). So Noor, or someone in her household, **sends an SMS in her own words or gives a free missed call**. She installs nothing.

### Where it fits in the journey

| Stage | Today | Aage Ke? |
|---|---|---|
| Fever starts | First stop is often a village doctor or pharmacy | **Pre-stage:** Rina can add a person with fever not yet tested ("জ্বর, পরীক্ষা হয়নি") and send a test reminder |
| Tested, sent home | Nobody tells the community clinic | Rina adds the patient after a test or a doctor's word |
| At home, fever ongoing | Daily review advised, rarely done | **Core:** the family writes in their own words; the model reads |
| Fever falls | Family thinks the patient is better and goes quiet | **Core:** silence in the critical days turns the patient amber |
| Warning sign | Goes to the nearest clinic, gets sent on | **Facility card:** nearest facility that admits dengue patients |
| At hospital | Arrives late, repeats the history | **Referral note** with illness day and confirmed signs |
| Records | Home-managed patients are invisible | DHIS2-shaped export |

## 2. How it works

```
Noor's basic phone            Rina's phone (offline web app)                          Hospital
SMS in own words  ───────►    paste / share into the app
missed call       ───────►    "মিসড কল এসেছে" button
                              │
                              ▼
                              small model suggests labels + confidence     (AI, 443 KB, on the phone)
                              │
                              ▼
                              Rina confirms or rejects each label          (person)
                              │
                              ▼
                              red / amber / green; in red, shock or bleeding first, then oldest   (rules)
                              │
                              ├─ call now (tel:) · visit today · refer
                              ├─ pre-written SMS, Rina presses send ─────────────────► Noor
                              └─ referral note + nearest facility ───────────────────► hospital
```

**Urgency uses confirmed labels only.**
- **Red:** any confirmed warning sign → call now or refer. Within red: shock or bleeding signs first, then oldest.
- **Amber:** a message the model did not understand, a confirmed mention of a test report, an unanswered missed call, an open referral ("রেফার করা হয়েছে — খোঁজ নিন") until Rina marks "হাসপাতালে পৌঁছেছে", or **silence**: illness day 3 to 7 (or fever confirmed down) and no message today.
- **Green:** everyone else. Nobody is ever removed from the list, and the screen says so.

## 3. What the AI does and does not do

**The AI does one job:** read free text in Bangla script, Banglish (Bangla in Latin letters) and regional spellings, and map it to a **fixed list of 8 warning signs and 4 status labels** with a confidence for each. The warning signs follow the home-observable WHO 2009 / CDC 2024 warning signs: severe abdominal pain, persistent vomiting, bleeding, lethargy or restlessness, reduced urine, cold clammy hands and feet, difficulty breathing, cannot drink or eat.

- **Model:** TF-IDF character n-grams (2 to 5, within word boundaries) and one-vs-rest logistic regression, 3,999 features × 12 labels, exported to a **443 KB JSON file** that runs in the browser. Python and JavaScript give the same probabilities to within 5 × 10⁻⁵.
- **Rules after the model:** a negation word within 3 tokens of a cue suppresses the label ("pet betha **nai**"), unless a "stop" word sits between them ("bomi bondho hocche **na**" = the vomiting does not stop, so the label stays). A past-tense cue in the same clause caps the label at **not sure** ("**kal** bomi hoisilo aj nai"), and past wins over negation, so ambiguity goes to a person.
- **Confidence bands:** p ≥ 0.75 is "✓ suggested", 0.45 to 0.75 is "নিশ্চিত নই — নিজে দেখে নিন", lower is dropped. No label at all gives "বুঝতে পারিনি — ফোন করুন". Only "fever down / feeling better" gives "কোনো সতর্কসংকেত পাওয়া যায়নি", which is shown, never silent.
- **Why:** under each label, the 2 or 3 words that pushed it up most (weight × coefficient).
- **Unfamiliar wording:** if few of a message's character patterns are in the model's vocabulary (below 0.674, the lowest value seen on the held-back training split), the app shows "এই লেখার ভাষা হয়তো চেনা নয় — নিজে পড়ে দেখুন". Labels are still shown.

**The AI does not:** write any text that reaches a patient, diagnose, read or judge a lab number, choose an action, or send anything. **No LLM, no server, no network calls.** Every SMS comes word for word from `app/templates.json`; the health worker presses send herself.

## 4. Guardrails

| Risk | Guardrail |
|---|---|
| Hallucination | The model can only pick from 12 fixed labels. It cannot produce free text. |
| Wrong label acted on | Every label needs Rina's tap. Unconfirmed labels change nothing. |
| Over-confidence | "Not sure" band, "did not understand", the unfamiliar-wording flag, and the "Why" line. |
| Negation and past tense | Explicit rules, tested in both Python and JavaScript on the same 591 texts (0 mismatches). |
| A blood test read as bleeding | Exclude phrases ("rokto porikkha", "blood test") never fire bleeding; they become "mentions a test report" → amber. |
| Shared family phone | SMS never contain a diagnosis or a disease name. |
| Calling a real hospital by accident | In demo mode, real facility numbers are masked (last 6 digits) and their call/SMS links are disabled. Demo patients have no numbers. |
| Wrong referral target | Community clinics are never offered; only facilities that admit dengue patients (UHC, district hospital, medical college hospital). |
| Silence after the fever falls | Silence itself turns a patient amber. |
| Test-set leakage | Training never reads a test file. Thresholds are set on the training split's held-back 20% only. |

## 5. Data sources

| Data | What | Source | Licence | Size | Used for |
|---|---|---|---|---|---|
| `data/train_sentences.csv` | Constructed family messages in Bangla and Banglish | Written for this project (`source=claude_draft`), labelled as synthetic; human verification pending | CC BY 4.0 (ours) | 580 rows | Training (80/20 split to choose C), then the shipped model on all 580 |
| `data/labels_dengue.json` | Fixed label list, cues, negation, past and stop words | Signs from WHO 2009 / CDC 2024 | ours | 8 + 4 labels | Labels, keyword baselines, rules |
| `data/test_t1_human.csv` | **Real messages from 4 volunteers in 4 districts** (Chandpur, Satkhira, Munshiganj, Pabna), written in their own words to a WhatsApp prompt | Volunteers, no names | ours | 17 | Final evaluation only |
| `data/test_t2_crowd.csv` | **Real messages, fully unseen** before evaluation (Dhaka) | Volunteers, no names | ours | 6 | Final evaluation only |
| `data/test_t3_real.csv` | **Real public health posts** (Facebook, YouTube): 25 fever + sign, 25 sign only, 30 other topics | Bangla Healthcare Severity Dataset (below), labels proposed and checked by the team | CC BY 4.0 | 80 | Final evaluation only |
| `data/test_challenge_synthetic.csv` | Hard cases: misspellings, mixed English, negation, past, 8 dialect probes | Synthetic, written for this project | ours | 33 | Gate 1 only; reported as a stress test, **never as human evidence** |
| `data/raw/bangla_healthcare_severity.csv` | Bangla health posts with severity classes | Pulock Deb Roy, Mst. Chameli Begum, Dolour Husain Sagor, Badar Hossain. *Bangla Healthcare Severity Dataset.* Mendeley Data, V1, 2026. [doi:10.17632/37z8kgx79m.1](https://data.mendeley.com/datasets/37z8kgx79m/1) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 5,263 posts | T3 and a descriptive run. **Changes made:** converted from the published XLSX to UTF-8 CSV (the published CSV lost its Bangla characters); no other change. Not redistributed here (`data/raw/` is not committed). |
| `data/facilities_nazirpur.json` | 3 referral facilities and 4 community clinics with coordinates, 4 union centroids | [OpenStreetMap](https://www.openstreetmap.org) coordinates; phone numbers only from the DGHS Facility Registry (hrm.dghs.gov.bd) | ODbL (OSM data) | 7 facilities | Facility card |

SMS wording sources: home care (rest, fluids, paracetamol only, no aspirin or ibuprofen, prevent bites) from [CDC "Manage Dengue"](https://cdc.gov/dengue/treatment/index.html); "get tested at the nearest hospital" from the DGHS advice of September 2025 ([Daily Star](https://www.thedailystar.net/health/disease/news/late-admission-leading-cause-dengue-deaths-3992161)); covering stored water from [BBC Bangla](https://www.bbc.com/bengali/articles/cqx7n9elw2yo). Facility admission status is "assumed" from the DGHS directive of September 2025 to run separate dengue wards in government hospitals (same Daily Star report).

## 6. What the data does not cover

- **Real patient messages.** None were used anywhere. T1 and T2 are real messages written by volunteers role-playing a family member, not by patients. Real follow-up messages need consent and field testing.
- **People with very low literacy.** T3 comes from Facebook and YouTube users, who are more connected than Noor.
- **Dialects we could not verify.** T1 and T2 cover Chandpur, Satkhira, Munshiganj, Pabna and Dhaka. Chittagonian and Sylheti are likely weakest; the challenge set has only 4 and 2 probes for them.
- **Chakma, Marma and other minority languages:** not covered at all.
- **Voice.** The tool reads text only.
- **Children as patients, pregnancy, co-infections.**
- **How often families actually reply**, and SMS delivery failures.
- **Dengue talk in T3.** Only 1 of the 5,263 source posts mentions dengue; T3 tests general warning-sign wording in real posts, not dengue follow-up messages.
- **Facility admission status** is assumed from a DGHS directive unless confirmed. **Travel time:** we show straight-line distance only.

## 7. Evaluation

> Test labels were proposed by Claude and checked by the team on 4 October 2026. The message texts were not changed. Full tables: [`model/results/results.md`](model/results/results.md), raw numbers: [`model/results/metrics.json`](model/results/metrics.json).

### Weak spots first

- **"Fever present" is badly recognised (F1 0.06 on 28 real rows).** The model confuses it with "fever has come down", because both are mostly the word *jor/জ্বর*. It is the most common label in T3. More training sentences for ongoing fever will fix most of it. It does not change the urgency tier (neither label is a warning sign), but it is wrong on screen.
- **Lethargy or restlessness is weak (F1 0.48, n=15).**
- **T3 misses 11 of 42 warning messages (26%).** Real public posts are long, mix several complaints and often describe conditions outside our list.
- **T2 is tiny (6 messages, only 1 with a warning sign)** and T1 rows were all read before the last rule fix, so T2 is the only fully clean check of the rules. Negation and past-tense subsets have only 3 real messages each.
- **The regional-dialect false-alarm test was not run**: the Vashantor corpus was not downloaded in time.

### Headline: missed warnings, next to micro-F1

A **missed warning** is a message with at least one real warning sign where the system suggests no warning sign at all. That is the costly error for this tool, so it comes first. Only the model's own bands (p ≥ 0.45) count as predictions; labels the health worker picks from "maybe" or adds herself never do.

| Test set | Missed warnings: model+rules | keyword | keyword + negation | Micro-F1: model+rules | keyword + negation |
|---|---|---|---|---|---|
| T1, 17 real volunteer messages | **0 / 12 (0%)** | 5 / 12 (42%) | 5 / 12 (42%) | **0.89** | 0.64 |
| T2, 6 real unseen messages | **0 / 1** | 1 / 1 | 1 / 1 | **0.67** | 0.00 |
| T3, 80 real public posts | **11 / 42 (26%)** | 20 / 42 (48%) | 20 / 42 (48%) | **0.47** | 0.41 |
| **Pooled real, 103** | **11 / 55 (20%)** | 26 / 55 (47%) | 26 / 55 (47%) | **0.57** | 0.44 |
| Challenge, 33 synthetic (stress test) | 4 / 23 (17%) | 16 / 23 (70%) | 16 / 23 (70%) | 0.83 | 0.44 |

On the pooled real sets the model **halves the missed warnings** compared with keyword matching (20% against 47%), and only 1 of the 11 misses was also left without a "did not understand → call them" prompt.

![Missed warnings and micro-F1, model vs keyword](model/results/charts/01_model_vs_keyword.png)

**T3 by group (model+rules):** fever + sign: 4 of 20 warning posts missed, micro-F1 0.42 · sign only: 3 of 17 missed, micro-F1 0.70 · other topics: **0 of 30 posts got a confident false alarm** (keyword: 1 of 30). Child posts (11): 3 of 10 warning posts missed.

**Are the confidence bands honest?** On the pooled real sets, labels shown as "✓ suggested" were right **89%** of the time (28 labels), and labels shown as "not sure" were right **52%** of the time (46 labels). The "not sure" band is doing its job: it marks the labels a person should check.

![Band reliability](model/results/charts/04_band_reliability.png)

**Descriptive run over all 5,263 source posts** (not accuracy): the share of posts that get at least one confident warning label is 17% for the dataset's *Emergency* class and 14% for *Urgent*, against 2% for *Routine* and 1% for *General Query*.

More charts: [by script and district](model/results/charts/02_by_script_and_district.png) · [negation and past tense](model/results/charts/03_negation_past.png).

**Gate 1** (13:30, on the synthetic challenge set, model trained on 464 rows): micro-F1 0.81 for model+rules against 0.44 for keyword+negation, so the model went ahead.

## 8. Privacy

| Question | Answer |
|---|---|
| **Where does the data sit?** | Only in IndexedDB on Rina's phone. No server, no analytics, no sync, no network calls. |
| **Who can read it?** | Only someone with Rina's PIN. Every patient record, her own details and the learning log are **encrypted with AES-GCM (256-bit)**; the key is derived from the PIN with PBKDF2 (SHA-256, 100,000 iterations, random salt) and kept only in memory while unlocked. |
| **Lost phone?** | The records are encrypted at rest. Honest caveat: a 4-digit PIN has only 10,000 values, so someone who copies the phone's storage could try them all offline. The app allows 4 to 6 digits and says a longer PIN is safer. A forgotten PIN means the records cannot be recovered. |
| **Shared phone (Noor's side)?** | SMS carry no diagnosis or disease name. |
| **What leaves the phone?** | Only what Rina chooses to send: SMS from fixed templates, a referral note, a DHIS2-shaped export (placeholder IDs, shaped like DHIS2 but **not connected to any live server**), and — only after a consent tick each session — a CSV of her ✓/✗ decisions. That CSV contains the message text as typed, so Rina should export only messages without names or numbers. |
| **Demo mode** | Fictional patients, kept in memory only and **not encrypted**; the screen says so. |

## 9. How to run

**Use it:** open https://nasimmahmudnayan.com/Aage-Ke/ on any phone. It works offline after the first load and can be installed to the home screen. On Android, an SMS can be shared straight into the app.

**Run locally:**
```bash
cd app && python -m http.server 8000      # then open http://localhost:8000
```

**Rebuild and test the model** (tested with Python 3.13 and Node 24; `pip install scikit-learn pandas numpy matplotlib`):
```bash
python model/test_cc2.py                  # preprocessing, rules, baselines; Python vs JS preprocessing
python model/train.py                     # choose C on the 80/20 split
python model/evaluate.py --quick          # Gate 1 on the synthetic challenge set
python model/train.py --final             # refit the shipped model on all rows, same C
python model/coverage.py                  # unfamiliar-wording threshold, held-back split only
python model/export.py                    # writes model_dengue.json (prints size) and copies app data
python model/parity_test.py               # Python vs JS probabilities, < 1e-3
python model/test_rules_parity.py         # Python vs JS rules and bands
python model/evaluate.py --full           # T1, T2, T3, pooled; charts and results.md
```

**Repository layout:** `app/` the offline web app (plain HTML and JavaScript, no framework, no build step) · `model/` training, export, tests, evaluation and results · `data/` labels, training sentences, test sets, facilities · `docs/` the design documents.

## 10. Limitations and next steps

**Limitations**
- Trained on 580 constructed sentences. Real-world accuracy is unknown until field testing with consented messages.
- Weaker on dialects we could not verify, and on long posts that mix several complaints.
- Signs not on the fixed list are not detected, for example burning urination, rash, chest pain, and skin bleeding or bruising (purpura). The health worker can add any listed sign herself, and anything else needs a call.
- Depends on someone telling the health worker about a positive test; the pre-stage status only partly covers this.
- Straight-line distance, not travel time; rivers and night travel are not modelled.
- SMS costs Rina money. Missed calls cost Noor nothing.

**Next steps**
- Have a native speaker verify the 580 training sentences, add training sentences for ongoing fever and lethargy, retrain (about two minutes).
- Two weeks with five health workers in one Pirojpur union, with consented messages.
- Use the on-phone ✓/✗ log, with consent, to retrain; refuse any training row found in a test set and reject a new model that scores worse on the test sets ([`NEXT_STEPS.md`](NEXT_STEPS.md)).
- Connect the export to a real DHIS2 tracker programme with the DGHS team.

## Licence

Code: [MIT](LICENSE). Constructed training sentences and test labels: CC BY 4.0. Bangla Healthcare Severity Dataset: CC BY 4.0, credited above. Facility coordinates: © OpenStreetMap contributors, ODbL.
