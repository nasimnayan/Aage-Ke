"""CC8: full evaluation over T1, T2, T3 separately and pooled (docs/03 CC8).

Headline on every set: missed warnings, next to micro-F1.
  missed warning = a message with at least one real warning sign where the system suggests
                   no warning sign at all (any band). A "silent" miss is also not routed to a
                   call by "did not understand".
A label counts as predicted when it reaches the "not sure" band or higher.
Test sets are only read here; nothing is trained or tuned on them.
Run: python model/evaluate.py --full [--verified]
"""
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, load_labels, label_keys  # noqa: E402
from evaluate import load_test, run_systems, GATE1_FILE  # noqa: E402
from report import charts, write_results_md  # noqa: E402

HERE = Path(__file__).resolve().parent
SYSTEMS = ["keyword", "keyword+neg", "model+rules"]
SETS = [("T1", "test_t1_human.csv"), ("T2", "test_t2_crowd.csv"), ("T3", "test_t3_real.csv")]
CHALLENGE = ("challenge", GATE1_FILE)
PENDING_NOTE = "labels pending final check"


def outcome(p, warn):
    if not p:
        return "not_understood"
    if not (set(p) & warn) and set(p) <= {"feeling_better", "fever_dropped"}:
        return "no_warning_sign"
    return "labels"


def _f1(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def score(gold_sets, preds, keys, warn):
    """All numbers for one system on one group of rows. preds: list of {label: band}."""
    n = len(gold_sets)
    out = {"rows": n}
    if not n:
        return out
    TP = FP = FN = exact = 0
    per = {k: [0, 0, 0] for k in keys}
    for g, p in zip(gold_sets, preds):
        ps = set(p)
        TP += len(g & ps)
        FP += len(ps - g)
        FN += len(g - ps)
        exact += g == ps
        for k in keys:
            per[k][0] += (k in g) and (k in ps)
            per[k][1] += (k not in g) and (k in ps)
            per[k][2] += (k in g) and (k not in ps)
    P, R, F = _f1(TP, FP, FN)
    out.update(micro_precision=round(P, 4), micro_recall=round(R, 4), micro_f1=round(F, 4),
               exact_match=round(exact / n, 4))
    out["per_label"] = {k: dict(zip(["precision", "recall", "f1"], [round(x, 4) for x in _f1(*v)]),
                                support=v[0] + v[2])
                        for k, v in per.items() if v[0] + v[2] or v[1]}
    warn_rows = [(g, p) for g, p in zip(gold_sets, preds) if g & warn]
    missed = [(g, p) for g, p in warn_rows if not (set(p) & warn)]
    silent = [(g, p) for g, p in missed if outcome(p, warn) != "not_understood"]
    wtp = sum(len(g & warn & set(p)) for g, p in warn_rows)
    wtot = sum(len(g & warn) for g, _ in warn_rows)
    nw = len(warn_rows)
    out["missed_warnings"] = {
        "messages_with_warning": nw, "missed": len(missed),
        "missed_rate": round(len(missed) / nw, 4) if nw else None,
        "silent_missed": len(silent), "silent_missed_rate": round(len(silent) / nw, 4) if nw else None,
        "warning_label_recall": round(wtp / wtot, 4) if wtot else None,
    }
    abst = sum(1 for p in preds if "unsure" in p.values() or outcome(p, warn) == "not_understood")
    out["abstention_rate"] = round(abst / n, 4)
    for b in ("sure", "unsure"):
        shown = [(k in g) for g, p in zip(gold_sets, preds) for k, bb in p.items() if bb == b]
        out[f"precision_{b}_band"] = round(sum(shown) / len(shown), 4) if shown else None
        out[f"labels_in_{b}_band"] = len(shown)
    return out


def full(verified=False):
    labels_json = load_labels()
    keys = label_keys(labels_json)
    warn = {x["key"] for x in labels_json["warning_signs"]}
    with open(HERE / "model.pkl", "rb") as f:
        m = pickle.load(f)
    note = None if verified else PENDING_NOTE

    frames = {}
    for name, fn in SETS + [CHALLENGE]:
        if (ROOT / "data" / fn).exists():
            frames[name] = load_test(fn)
        else:
            print(f"{name}: {fn} not found, skipped")
    real = [n for n, _ in SETS if n in frames]
    frames["pooled"] = pd.concat([frames[n] for n in real], ignore_index=True)
    preds = {name: run_systems(d["text"].astype(str).tolist(), m, labels_json) for name, d in frames.items()}

    def block(name, mask=None):
        d = frames[name]
        idx = np.arange(len(d)) if mask is None else np.where(mask)[0]
        gold = [set(x for x in d["labels"].iloc[i].split("|") if x) for i in idx]
        return {s: score(gold, [preds[name][s][i] for i in idx], keys, warn) for s in SYSTEMS}

    train = json.load(open(HERE / "results" / "train_report.json", encoding="utf-8"))
    M = {"note": note, "model": {"C": m["C"], "train_rows": train["final_model"]["rows"]},
         "definitions": {
             "missed_warning": "message with >=1 real warning sign where the system suggests no warning sign at any band",
             "silent_missed": "missed warning that is also not routed to a call by 'did not understand'",
             "predicted": "label at 'not sure' band (p >= 0.45) or higher",
             "abstention": "message with any 'not sure' label or the 'did not understand' outcome"},
         "sets": {name: block(name) for name in frames}, "splits": {}}

    sp = M["splits"]
    for name in real + ["pooled"]:
        d = frames[name]
        sp.setdefault("script", {})[name] = {sc: block(name, (d["script"] == sc).to_numpy())
                                             for sc in sorted(d["script"].unique())}
        if name in ("T1", "T2") and "district" in d:
            sp.setdefault("district", {})[name] = {di: block(name, (d["district"] == di).to_numpy())
                                                   for di in sorted(d["district"].unique()) if di}
        for col, key in (("is_negated", "negation"), ("is_past", "past")):
            if col in d:
                mask = (d[col].astype(str) == "1").to_numpy()
                if mask.any():
                    sp.setdefault(key, {})[name] = block(name, mask)
    if "T1" in frames:
        d = frames["T1"]
        seen = (d["seen_before_rule_fix"].astype(str) == "1").to_numpy()
        sp["T1_seen_before_rule_fix"] = {"seen (1)": block("T1", seen), "unseen (0)": block("T1", ~seen)}
    if "T3" in frames:
        d = frames["T3"]
        sp["T3_group"] = {g: block("T3", (d["group"] == g).to_numpy()) for g in ["fever+sign", "sign_only", "other"]}
        child = d["label_note"].str.contains(r"\bchild\b", case=False, regex=True).to_numpy()
        sp["T3_child"] = {"child posts": block("T3", child), "other posts": block("T3", ~child)}
        other = np.where((d["group"] == "other").to_numpy())[0]
        M["false_alarms_T3_other"] = {}
        for s in SYSTEMS:
            hits = sum(1 for i in other if any(k in warn and b == "sure" for k, b in preds["T3"][s][i].items()))
            M["false_alarms_T3_other"][s] = {"rows": len(other), "with_confident_warning": hits,
                                             "rate": round(hits / len(other), 4) if len(other) else None}
    M["false_alarms_vashantor"] = "not run: the Vashantor corpus is not in data/raw"

    raw = ROOT / "data" / "raw" / "bangla_healthcare_severity.csv"
    if raw.exists():
        r = pd.read_csv(raw, keep_default_na=False)
        rp = run_systems(r["Text"].astype(str).tolist(), m, labels_json)["model+rules"]
        r["confident_warning"] = [any(k in warn and b == "sure" for k, b in p.items()) for p in rp]
        M["descriptive_severity"] = {c: {"posts": int(len(g)),
                                         "share_with_confident_warning": round(float(g["confident_warning"].mean()), 4)}
                                     for c, g in r.groupby("Categories")}

    (HERE / "results").mkdir(exist_ok=True)
    with open(HERE / "results" / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(M, f, indent=2, ensure_ascii=False)
    charts(M, note, SYSTEMS)
    write_results_md(M, note, SYSTEMS)
    print_summary(M, note)
    return 0


def _fmt(x, pct=False):
    if x is None:
        return "–"
    return f"{100 * x:.0f}%" if pct else f"{x:.2f}"


def print_summary(M, note):
    print(("[" + note.upper() + "] ") if note else "", "CC8 full evaluation")
    print(f"{'set':10s}{'system':14s}{'rows':>5s}{'missed warn':>15s}{'silent':>8s}{'micro-F1':>10s}{'exact':>8s}{'abstain':>9s}")
    for name in ["T1", "T2", "T3", "pooled", "challenge"]:
        for s in SYSTEMS if name in M["sets"] else []:
            r = M["sets"][name][s]
            mw = r["missed_warnings"]
            txt = f"{mw['missed']}/{mw['messages_with_warning']} ({_fmt(mw['missed_rate'], True)})" if mw["messages_with_warning"] else "–"
            print(f"{name:10s}{s:14s}{r['rows']:>5d}{txt:>15s}{mw['silent_missed']:>8d}{_fmt(r['micro_f1']):>10s}"
                  f"{_fmt(r['exact_match']):>8s}{_fmt(r['abstention_rate'], True):>9s}")
