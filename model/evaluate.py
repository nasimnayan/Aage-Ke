"""Evaluation. --quick is Gate 1 (docs/03 CC3): first 30 rows of T1, micro-F1 for
keyword, keyword+neg and model+rules. A label counts as predicted if it reaches the
"not sure" band or higher. Test sets are only read here, never used to train or tune.
"""
import argparse
import json
import pickle
import sys
from pathlib import Path

import pandas as pd
from sklearn.metrics import f1_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, preprocess, detect_script, load_labels, label_keys  # noqa: E402
from rules import Rules  # noqa: E402
from baseline import keyword, keyword_neg  # noqa: E402
from train import to_sets, to_matrix, system_predict  # noqa: E402

HERE = Path(__file__).resolve().parent


def load_test(name):
    d = pd.read_csv(ROOT / "data" / name, keep_default_na=False)
    if "script" not in d or (d["script"] == "").any():
        d["script"] = [s or detect_script(t) for t, s in zip(d["text"], d.get("script", [""] * len(d)))]
    return d


def run_systems(texts, m, labels_json):
    keys = m["keys"]
    rules = Rules(labels_json)
    probs = m["clf"].predict_proba(m["vec"].transform([preprocess(t) for t in texts]))
    return {
        "keyword": [keyword(t) for t in texts],
        "keyword+neg": [keyword_neg(t) for t in texts],
        "model+rules": system_predict(texts, probs, keys, rules, labels_json["bands"]),
    }


def quick():
    labels_json = load_labels()
    keys = label_keys(labels_json)
    with open(HERE / "model.pkl", "rb") as f:
        m = pickle.load(f)
    d = load_test("test_t1_human.csv").head(30)
    if len(d) < 30:
        print(f"T1 has {len(d)} rows; Gate 1 needs 30. Not run.")
        return 2
    gold = to_matrix(to_sets(d["labels"]), keys)
    systems = run_systems(d["text"].astype(str).tolist(), m, labels_json)

    result = {"rows": len(d), "scripts": d["script"].value_counts().to_dict(), "micro_f1": {}, "per_label_f1": {}}
    for name, preds in systems.items():
        pm = to_matrix([set(p) for p in preds], keys)
        result["micro_f1"][name] = round(float(f1_score(gold, pm, average="micro", zero_division=0)), 4)
        per = f1_score(gold, pm, average=None, zero_division=0)
        support = gold.sum(axis=0)
        result["per_label_f1"][name] = {k: (round(float(v), 3), int(s)) for k, v, s in zip(keys, per, support)}

    print(f"Gate 1 · T1 first {len(d)} rows · scripts {result['scripts']}")
    print(f"{'system':14s} micro-F1")
    for name, v in result["micro_f1"].items():
        print(f"{name:14s} {v:.3f}")
    print("\nPer-label F1 (support):")
    print(f"{'label':24s}" + "".join(f"{n:>14s}" for n in systems))
    for k in keys:
        cells = "".join(f"{result['per_label_f1'][n][k][0]:>10.3f} ({result['per_label_f1'][n][k][1]:>2d})" for n in systems)
        print(f"{k:24s}{cells}")

    beat = result["micro_f1"]["model+rules"] > result["micro_f1"]["keyword+neg"]
    result["gate1_pass"] = beat
    print("\nGate 1:", "PASS (model+rules beats keyword+neg)" if beat else
          "FAIL: model+rules <= keyword+neg. Add training sentences for weak labels, retrain.")
    (HERE / "results").mkdir(exist_ok=True)
    with open(HERE / "results" / "gate1.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="Gate 1: first 30 rows of T1")
    args = ap.parse_args()
    if args.quick:
        sys.exit(quick())
    print("--full comes in CC8")
