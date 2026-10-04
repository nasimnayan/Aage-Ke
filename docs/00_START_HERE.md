# Aage Ke? (আগে কে?) · Start here

Read this page first. Every agent (Claude chat, Claude Code, Cowork) works from these files.
Where these files and the hackathon brief (`health.pdf`) disagree, the brief wins.

**Deadline: Sunday 4 October 2026, 19:00 Asia/Dhaka.** Uploads stay open 15 minutes after.
**Two submissions are required:** the HackOS platform AND the Google Form (https://forms.gle/VS65tsovASMuBwEn9).

---

## The idea in one paragraph

Aage Ke? is an offline tool on the phone of a Community Health Care Provider (CHCP) at a community clinic in Nazirpur upazila, Pirojpur. When a person with dengue is being cared for at home, the CHCP adds them to her list. The family sends an SMS in their own words, or gives a missed call. A small on-device model (under 500 KB) reads the message and suggests labels from a fixed list of 8 dengue warning signs, each with a band: sure, not sure, or "did not understand, call them". The CHCP confirms every label. The list sorts itself red, amber, green, and anyone who goes silent after the fever falls turns amber. On red, the tool shows the nearest facility that admits dengue patients, opens a pre-written SMS and referral note, and the CHCP presses send herself. Records export in a DHIS2-shaped format.

**AI reads. Code does everything else. A person decides.**

## Locked decisions

| Item | Decision |
|---|---|
| Track | Challenge 04, Small AI for Development, Health sector |
| The one user | CHCP at a community clinic. Persona: "Rina" (fictional) |
| The person served | Noor (the brief's persona), basic phone, SMS and missed calls only, no app |
| Place | Nazirpur upazila, Pirojpur district. Fallback Kawkhali or Bhandaria if facility data is thin |
| Moment | Home-managed dengue, from fever to the end of the critical phase (about day 3 to 7) |
| AI | TF-IDF character n-grams + one-vs-rest logistic regression, runs in the browser, plus negation and past-tense rules |
| Language | Bangla script and Banglish (Bangla in Latin letters). Regional forms measured, not assumed |
| Facility help | A card listing the nearest facility that admits dengue, straight-line distance, phone, map link. No routing, no map tiles |
| Records | DHIS2-shaped JSON export (placeholder IDs, stated as such) |
| Judges | "Judge mode" button loads 6 fictional patients and an English toggle |

## Cut (do not build)

Pregnancy module (one line in the video only) · voice features · Lovable · Bright Data · offline map tiles · route finding · any LLM on the device · any AI-written text sent to patients.
ElevenLabs only if everything else is finished by 16:15, and only for 2 or 3 pre-written Bangla clips.

## Three test sets, never used for training or tuning

| Set | Who writes it | Size target |
|---|---|---|
| T1 human | Nasim, written before seeing any training data | 30 to 60 |
| T2 crowd | Friends and family from different districts, via the WhatsApp prompt in `02_data_and_sources.md` | 60 to 90 |
| T3 real | Real Bangla health posts from the Bangla Healthcare Severity Dataset. Claude proposes labels, Nasim verifies | 80 |

## Roles

| Who | Owns |
|---|---|
| Nasim | Every decision. T1. Verifying T2 and T3 labels and all Bangla text. Video. Both submissions. |
| Claude (chat) | Architecture, these files, `labels_dengue.json`, training sentences, SMS templates, video script, review against the brief |
| Cowork | Dataset downloads and licence checks, Nazirpur facility data, original source URLs, crowd message collation, screenshots, final checklist (`04_cowork_tasks.md`) |
| Claude Code | Repo, model training, evaluation, export, the PWA, charts, GitHub Pages (`03_claude_code_tasks.md`) |

**Hard boundary:** personal-capacity entry. No employer name, data, systems, branding or work time anywhere.

## Timeline and gates (Asia/Dhaka)

| Time | Work |
|---|---|
| Now | Create the team on HackOS (a team of one is fine). Send the WhatsApp prompt. Nasim writes the first 30 T1 messages. |
| 12:15 to 13:30 | Claude: labels + training sentences. Claude Code: repo + model v0. Cowork: datasets + facility data. |
| **13:30 Gate 1** | Model v0 vs keyword baselines on the first 30 T1 messages. If the model does not beat keyword+negation, add training data for weak labels and retrain before anything else. |
| 13:30 to 15:30 | PWA, judge mode, facility card, referral note, export, deploy, airplane-mode test on a real phone |
| **15:30 Gate 2** | Feature freeze. Only fixes after this. |
| 15:30 to 16:15 | Full evaluation on T1+T2+T3, four charts, README |
| 16:15 to 18:15 | Record three 60-second clips and join them (`05_video_and_submission.md`) |
| 18:15 to 18:45 | Submit on HackOS and the Google Form. 15 minutes spare. |

## Files

- `00_START_HERE.md` this page
- `01_solution_design.md` what the tool does and why
- `02_data_and_sources.md` datasets, test sets, every number with its link, what the data does not cover
- `03_claude_code_tasks.md` build steps with acceptance checks
- `04_cowork_tasks.md` data collection steps
- `05_video_and_submission.md` video script and submission checklist
- `labels_dengue.json` the fixed list, cues, negation and past-tense words
