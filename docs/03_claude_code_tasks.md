# 03 · Claude Code tasks

Read `00_START_HERE.md`, `01_solution_design.md` and `labels_dengue.json` first.
Work in order. Each task ends with an acceptance check. Do not start the next task until the check passes.
Do not add features that are not listed. New ideas go to `NEXT_STEPS.md`.

## Repo layout

```
aage-ke/
  data/
    labels_dengue.json
    train_sentences.csv
    test_t1_human.csv  test_t2_crowd.csv  test_t3_real.csv
    facilities_nazirpur.json
    raw/            (gitignored if licence forbids redistribution)
  model/
    preprocess.py  baseline.py  train.py  evaluate.py  export.py  parity_test.py
    model_dengue.json
    results/        (metrics.json, results.md, charts/*.png)
  app/
    index.html  app.js  model.js  rules.js  store.js  i18n.js  templates.json
    facilities.json  demo_data.json  sw.js  manifest.json  icons/
  README.md  NEXT_STEPS.md  LICENSE
```

Python: scikit-learn, pandas, numpy, matplotlib. App: plain HTML + vanilla JS, no framework, no build step, no CDN at runtime.

---

## CC1 · Scaffold (15 min)

Create the layout above, a public GitHub repo, and GitHub Pages serving `/app`.
**Check:** the Pages URL loads a placeholder page.

## CC2 · Preprocessing and baselines (20 min)

`preprocess.py`, mirrored exactly in `app/model.js`:
1. Unicode NFC
2. Remove ZWJ (U+200D) and ZWNJ (U+200C)
3. Lowercase Latin letters
4. Bangla digits ০-৯ → 0-9
5. Collapse any character repeated 3+ times to 2 ("betthaaaa" → "betthaa")
6. Replace punctuation with spaces, collapse whitespace

Script detection: share of Bangla-block characters among letters. ≥ 0.8 `bn`, ≤ 0.2 `banglish`, else `mixed`.

`baseline.py`, two baselines:
- **keyword**: a label fires if any of its cues (bangla, banglish) appears as a substring after preprocessing.
- **keyword+neg**: keyword, plus the same negation and past rules the model uses (`rules` in labels JSON).
- Rules run on clauses split from the raw text (`rules.clause_breaks`) before punctuation is removed. Bleeding never fires on `exclude_phrases` such as "rokto porikkha".

**Check:** unit tests on 10 hand examples, including "pet betha nai" (keyword fires, keyword+neg does not).

## CC3 · Train, export, parity (45 min) → Gate 1 at 13:30

`train.py`:
- Read `train_sentences.csv`, keep `verified` rows plus `claude_draft` rows (report both counts).
- Split 80/20 stratified on primary label → train / dev. Test files are never read here.
- Features: `TfidfVectorizer(analyzer="char_wb", ngram_range=(2,5), max_features=4000, sublinear_tf=True)`.
- Model: one-vs-rest `LogisticRegression(class_weight="balanced", max_iter=2000)`, choose C from {0.5, 1, 2, 4} on dev micro-F1.
- Rules after the model (see `labels_dengue.json → rules`): negation suppress, negated `fever_present` → `fever_dropped`, past cue caps band at "not sure".
- Bands: ≥ 0.75 suggested, 0.45 to 0.75 not sure, < 0.45 dropped. Thresholds may move only using dev.

`export.py` → `model/model_dengue.json`:
`{version, labels, vocab: {ngram: index}, idf: [...], coef: [[...]], intercept: [...], thresholds, rules_ref}`.
Round weights to 4 decimals. Drop vocab entries whose coefficients are all below 1e-4 in absolute value. **Print the file size.** Target under 500 KB.

`parity_test.py`: run Python and JS (Node) inference on every T1 row. Max absolute probability difference < 1e-3.

**Gate 1 script** `evaluate.py --quick`: first 30 rows of T1. Print micro-F1 for keyword, keyword+neg, model+rules.
- If model+rules ≤ keyword+neg: stop, report which labels are weak, wait for more training sentences, retrain.

**Check:** size printed, parity passes, Gate 1 table printed.

## CC4 · App core (90 min)

Screens (Bangla UI by default):
1. **PIN** (4 digits) with "Try the demo (judges)" button.
2. **Inbox**: patients grouped red / amber / green, oldest first within tier, line "কাউকে তালিকা থেকে বাদ দেওয়া হয় না".
3. **Patient**: code, union, illness day (computed from onset date), fever-dropped date, confirmed signs, message history with outcome per message.
4. **Add message**: paste box + "মিসড কল এসেছে" button + "নিজের নোট" box.
5. **Labels**: chips with band styling (✓ suggested / নিশ্চিত নই / dropped hidden). Each chip needs a tap to confirm or reject. Unconfirmed chips affect nothing.
6. **Action**: call now (`tel:`), visit today (logs), refer.
7. **SMS composer**: template from `templates.json`, filled, opened via `sms:<number>?body=<encoded>`. Rina presses send in her SMS app.

Storage: IndexedDB via `store.js`. Target encryption: AES-GCM, key from PIN with PBKDF2 (WebCrypto, 100k iterations, random salt). If not done by 15:00, keep PIN as a screen lock and write that plainly in the README.

Urgency rules exactly as `01_solution_design.md §6`. Silence rule uses the phone's local date.

**Check:** add a patient, paste "pet e khub betha, 2 bar bomi korse", confirm both labels, patient turns red, refer opens SMS app with filled text.

## CC5 · Judge mode and English toggle (30 min)

`demo_data.json`: the six patients in `01_solution_design.md §11`, with English glosses.
Toggle `বাংলা | English` changes UI strings (`i18n.js`) and shows glosses under messages. Model input never changes.
**Check:** a fresh browser reaches the red patient in under 3 taps from the PIN screen.

## CC6 · Facility card, referral note, export (30 min)

- Load `facilities.json` (copied from `data/facilities_nazirpur.json`). Each patient has a `union` with a centroid.
- On refer: nearest facility with `admits_dengue` in {true, "assumed"} by haversine distance. Never a community clinic.
- Card: name, type, distance "সরলরেখায় X কিমি", phone or "নম্বর যাচাই হয়নি", `geo:` link, Google Maps link, "ভর্তির তথ্য যাচাই করা হয়নি" if assumed.
- Referral note text per `01_solution_design.md §8`, sent via `sms:` to the facility number if present, else copy button.
- Export button: download DHIS2-shaped JSON events (`01_solution_design.md §9`).
- Judge mode: mask facility numbers (last 6 digits) and disable their tel:/sms: links. Demo patients have no numbers; patient SMS opens as `sms:?body=...` with no recipient.
- Use `phone`, ignore `phone_alt` unless Nasim says otherwise.
**Check:** referring P-01 shows Nazirpur UHC, never a community clinic; in judge mode no real number is dialable; export file opens as valid JSON.

## CC7 · Offline (20 min)

Service worker caches every app file and `model_dengue.json` on first load. `manifest.json` for install.
Bonus only if time: Web Share Target (`share_target` in manifest) so an SMS can be shared into the app.
**Check:** load once, turn on airplane mode, reload, run the CC4 check again. Record a 20-second screen capture of this for the video.

## CC8 · Full evaluation and charts (30 min, after 15:30 freeze)

`evaluate.py --full` over T1, T2, T3 separately and pooled:
- per-label precision, recall, F1; micro-F1; exact match
- model+rules vs keyword vs keyword+neg
- abstention rate ("not sure" + "did not understand")
- band reliability: precision of labels in the ≥ 0.75 band, and in the 0.45 to 0.75 band
- splits by script (bn / banglish / mixed) and by district (T2)
- negation subset and past subset
- false alarms: share of Vashantor test sentences (by dialect) and of T3 non-relevant rows that get any ≥ 0.75 label
- descriptive run over all 5,263 T3 source posts by original severity class

Charts (`model/results/charts/`), plain matplotlib, readable at phone size:
1. `01_model_vs_keyword.png` micro-F1 per test set, three bars each
2. `02_by_script_and_district.png` F1 and abstention
3. `03_negation_past.png` correct handling rate, model vs keyword
4. `04_band_reliability.png` precision per band

Write `results.md` with every number. If something is weak, write it in the first paragraph.
**Check:** charts render, `results.md` numbers match `metrics.json`.

## CC9 · README (20 min)

Sections, in this order: one-line summary + Pages link + 60-second judge path · Problem and user · How it works · What AI does and does not do · Guardrails · Data sources with licence and size · What the data does not cover · Evaluation (charts, weak spots first) · Privacy (where data sits, who reads it, lost or shared phone) · How to run · Limitations and next steps.
Copy text from `01` and `02`. English only, except Bangla UI examples.
**Check:** no employer name anywhere (`grep -ri` for it), every number has a link from `02 §3`.
