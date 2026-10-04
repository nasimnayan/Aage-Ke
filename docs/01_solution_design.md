# 01 · Solution design

## 1. Problem

Most people with dengue are cared for at home. WHO guidance says a home-managed (Group A) patient should be reviewed every day until the critical phase is over, because warning signs tend to appear around the time the fever falls. In rural Bangladesh nobody does that daily review. The family thinks the patient is recovering and goes quiet. By the time they reach hospital it is often late: in DGHS's 2025 death review, 66 of 114 reviewed deaths happened within 24 hours of admission. In 2026, 256 people had died of dengue by 3 October.

**Problem statement (for the video, verify numbers on the day):**
> Because of this tool, a community health worker will know the same day which of her dengue patients at home has reported a warning sign after the fever falls, which she would otherwise learn about only when the family reaches hospital too late; we know because WHO advises daily review of home-managed dengue patients until the critical phase ends, and in DGHS's 2025 dengue death review, 66 of 114 reviewed deaths happened within 24 hours of admission.

## 2. The one user

**Rina (fictional), Community Health Care Provider (CHCP)** at a community clinic in Nazirpur upazila, Pirojpur.

- One CHCP runs each community clinic, which serves about 6,000 people within half an hour's walk.
- About 14,000 community clinics already record services in DHIS2.
- She has an Android smartphone, intermittent data, and a busy clinic.

**Noor** (the brief's persona) is the person served. She has a basic phone. She, or someone in her household, sends SMS or gives a missed call. She never installs anything.

## 3. Journey and gaps

| Stage | What happens now | Gap | What Aage Ke? does |
|---|---|---|---|
| 1. Fever starts | First stop is often a village doctor or pharmacy | No test, no warning-sign teaching | Not covered (next step) |
| 2. Tested, sent home | Hospital or UHC sends a Group A patient home | Nobody tells the community clinic | CHCP adds the patient after a test or a doctor's word |
| 3. Home, fever ongoing | Daily review advised, rarely done | Families do not recognise warning signs | **Core:** family writes in own words, AI reads |
| 4. Fever falls | Family thinks patient is better, goes silent | Critical phase is unwatched | **Core:** silence in the window turns amber |
| 5. Warning sign | Goes to nearest clinic, gets sent on | Time lost at the wrong facility | **Facility card:** nearest facility that admits dengue |
| 6. Arrives at hospital | Late, crowded, repeats history | 2025 review: 66 of 114 deaths within 24 h of admission | **Core:** referral note with illness day and signs |
| 7. Records | DGHS daily counts show admitted patients | Home-managed patients are invisible | DHIS2-shaped export |
| 8. After discharge | No follow-up | | Not covered (next step) |

Known gap in our own design: if nobody tells the CHCP about a positive test (stage 2), the patient never reaches her list. State this in the README limitations.

**Added 4 Oct (pre-stage):** stage 1 is now partly covered. Rina can add a person with fever who has not been tested yet, status "জ্বর, পরীক্ষা হয়নি". The same warning-sign reading and tiers apply. The app suggests the `test_reminder` SMS, and a "পরীক্ষা হয়েছে" button switches the person to the tested status. No AI change.

## 4. How it works

```
Noor's basic phone                Rina's phone (offline PWA)                     Facility
------------------                ---------------------------                    --------
SMS in own words  ─────────────>  Inbox (paste or share)                        
Missed call       ─────────────>  "Missed call" button logs it                  
                                  │
                                  ▼
                                  Model suggests labels + bands  (AI)
                                  │
                                  ▼
                                  Rina confirms each label       (human)
                                  │
                                  ▼
                                  Urgency tier: red / amber / green  (rules)
                                  │
                                  ▼
                                  Action: call now / visit today / refer  (human picks)
                                  │
                                  ├── SMS composer (sms: link, Rina presses send)  ──> Noor
                                  └── Referral note + facility card  ───────────────> UHC
```

## 5. What the AI does and does not do

**AI does (one job):** read free text in Bangla script, Banglish and regional forms, and map it to the fixed list in `labels_dengue.json`, with a confidence per label. It says when it has not understood.

**Rules (code, not AI):**
- Negation: if a negation word (`labels_dengue.json → negation_cues`) sits within 3 tokens of a label's cue, suppress that label. A negated `fever_present` becomes `fever_dropped`.
- Past tense: if a past cue (`past_cues`) appears in the same clause as a label's cue, cap that label at the "not sure" band. Past wins over negation, so "kal bomi hoisilo aj nai" goes to a person instead of being dropped.

**Code does everything else:** urgency sorting, silence detection, facility choice, SMS text, referral note, export. The AI never writes text that goes to a patient. Say this openly in the video.

## 6. Bands and urgency

Per label, after rules:

| Probability | Band shown to Rina |
|---|---|
| ≥ 0.75 | ✓ suggested, Rina confirms |
| 0.45 to 0.75 | **নিশ্চিত নই — নিজে দেখে নিন** |
| < 0.45 | dropped |
| No warning sign and no status label above 0.45 | **বুঝতে পারিনি — ফোন করুন** |
| Only `feeling_better` and/or `fever_dropped` | **কোনো সতর্কসংকেত পাওয়া যায়নি** (shown, never silent) |

The fixed list has 8 warning signs and 4 status labels (`fever_dropped`, `fever_present`, `feeling_better`, `test_result_mentioned`). A message about a blood test or platelet report gets `test_result_mentioned`, which goes amber so Rina calls and asks. The tool never reads or judges a lab number.

Thresholds may be tuned on the training dev split only, never on T1, T2 or T3.

Urgency tiers use **confirmed labels only**:

1. **Red:** any confirmed warning sign → call now or refer.
2. **Amber:** a "did not understand" message, a confirmed `test_result_mentioned`, or an unanswered missed call → call today.
3. **Amber (silence):** illness day 3 to 7, or fever confirmed dropped, and no message today.
4. **Green:** everyone else.

Within a tier, oldest first. Nobody is removed from the list; the screen says so.

## 7. Facility card

When Rina picks "refer", the app picks the nearest facility in `data/facilities_nazirpur.json` with `admits_dengue` true or assumed, measured from the patient's union centroid. It shows:

- facility name and type (UHC, district hospital, medical college hospital)
- straight-line distance in km, labelled as straight-line
- phone number if an official source gives one, otherwise "number not verified"
- a `geo:` link and a Google Maps link (open only when there is signal)
- a small note: "ভর্তির তথ্য যাচাই করা হয়নি" when `admits_dengue` is "assumed"

Community clinics are never offered as a referral destination.

**Real numbers safety:** facility phone numbers are real public numbers from the government facility registry. In judge mode they are masked (last 6 digits hidden) and their `tel:`/`sms:` links are disabled, so no judge or tester can call or text a real hospital by accident. Demo patients have no phone numbers; the SMS composer opens with an empty recipient.

## 8. SMS templates (Nasim verifies wording)

No diagnosis words. No disease name. The phone may be shared.

| Key | Text |
|---|---|
| `enrol` | আপনার জ্বরের খোঁজ রাখছি। প্রতিদিন কেমন আছেন নিজের ভাষায় SMS করুন, অথবা আমাকে একটা মিসড কল দিন। — [আপার নাম] |
| `daily` | আজ কেমন আছেন? পেটে ব্যথা, বমি, রক্ত, বা খুব দুর্বল লাগলে লিখে জানান। |
| `window` | জ্বর কমলেও সাবধান। পেটে তীব্র ব্যথা, বারবার বমি, মাড়ি বা নাক দিয়ে রক্ত, খুব দুর্বল লাগা, বা প্রস্রাব কমে গেলে সাথে সাথে মিসড কল দিন। |
| `callback` | আপনার খবর পেয়েছি। আমি কিছুক্ষণের মধ্যে ফোন করছি। |
| `not_understood` | আপনার মেসেজ পুরো বুঝিনি। আমি ফোন করছি। |
| `refer` | আজই [হাসপাতাল]-এ যান। ফোন: [নম্বর]। আমি হাসপাতালকে জানিয়ে রাখছি। — [আপার নাম] |

**Referral note** (to the facility, sent by Rina):
`রেফারেল [কোড] | [ইউনিয়ন] | জ্বরের দিন [N] | দেখা গেছে: [নিশ্চিত চিহ্ন] | পাঠিয়েছেন: [আপা], [কমিউনিটি ক্লিনিক], [নম্বর]`

**Added 4 Oct (pre-stage, Nasim approved as an exception to the task list):**

| Key | Text |
|---|---|
| `test_reminder` | জ্বর হলে কাছের সরকারি হাসপাতালে রক্ত পরীক্ষা করান। — [আপার নাম] |
| `home_care` | বিশ্রাম নিন, বেশি করে পানি, স্যালাইন ও তরল খান। জ্বর বা ব্যথায় শুধু প্যারাসিটামল; অ্যাসপিরিন বা আইবুপ্রোফেন খাবেন না। রোগী মশারির ভেতরে থাকুন। |
| `water_containers` | জমানো পানির পাত্র ঢেকে রাখুন। বোতল, টব, ডাবের খোসায় পানি জমতে দেবেন না; দুই দিনের বেশি জমে থাকা পানি ফেলে দিন। |

## 9. DHIS2-shaped export

One JSON event per referral, shaped like a DHIS2 tracker event. IDs are placeholders. README must say "shaped like DHIS2, not connected to any live server".

```json
{
  "program": "PLACEHOLDER_dengue_home_followup",
  "orgUnit": "PLACEHOLDER_community_clinic",
  "eventDate": "2026-10-04",
  "dataValues": [
    {"dataElement": "illness_day", "value": "5"},
    {"dataElement": "warning_signs_confirmed", "value": "abdominal_pain;persistent_vomiting"},
    {"dataElement": "action", "value": "refer"},
    {"dataElement": "referred_to", "value": "facility_id"}
  ]
}
```

## 10. Privacy and safety (pass/fail)

| Question in the brief | Answer |
|---|---|
| Where does the data sit? | Only in IndexedDB on Rina's phone. No server, no analytics, no sync. |
| Who can read it? | Whoever knows Rina's PIN. Target: records encrypted with AES-GCM, key derived from the PIN (PBKDF2, WebCrypto). If encryption is not finished, the README must say the PIN is a screen lock only. |
| Lost phone? | PIN-locked, local only. Nothing leaves the phone except SMS and referral notes Rina chose to send. |
| Shared phone (Noor's side)? | SMS carry no diagnosis or disease name. |
| Hallucination? | The model only picks from a fixed list. It cannot produce free text. |
| Human in the loop? | Rina confirms every label and presses send on every SMS. |
| Fail-safe? | "নিশ্চিত নই" and "বুঝতে পারিনি — ফোন করুন" bands. |
| Diagnosis? | No. Patients are added after a test or a doctor's word. The tool watches for listed signs. |

All demo data is fictional. No real patient messages anywhere.

## 11. Judge mode

A button on the PIN screen: "Try the demo (judges)". It skips the PIN and loads six fictional patients:

| Code | Illness day | Latest message | Expected outcome |
|---|---|---|---|
| P-01 Noor | 5, fever fell yesterday | pet e khub betha, 2 bar bomi korse | Red: abdominal_pain, persistent_vomiting |
| P-02 | 4 | pet betha nai, valo achi | Green: nothing found (negation) |
| P-03 | 3 | kal bomi hoisilo aj nai | Not sure: persistent_vomiting (past) |
| P-04 | 6 | dat theke rokto porse | Red: bleeding |
| P-05 | 4 | kemon jani kortese | Amber: did not understand |
| P-06 | 5 | (no message today) | Amber: silent in the window |

English toggle translates the UI chrome and shows an English gloss under each Bangla message for judges.

## 12. Limitations to state

- Trained on constructed sentences. Real-world accuracy is unknown until field testing with consented messages.
- Weaker on dialects we could not verify. The charts show where.
- Facility admission status is assumed from a DGHS directive unless an official source confirms it.
- Straight-line distance, not travel time. Rivers and night travel are not modelled.
- Depends on someone telling the CHCP about a positive test.
- SMS costs Rina money. Missed calls cost Noor nothing.
