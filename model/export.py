"""Export the trained model to JSON for the browser (docs/03 CC3).

{version, labels, vocab: {ngram: index}, idf: [...], coef: [[...]], intercept: [...], thresholds, rules_ref}
Weights rounded to 4 decimals. Vocab entries whose coefficients are all below 1e-4 are dropped.
Writes model/model_dengue.json and copies it, the labels and the facilities into app/ for the PWA.
"""
import json
import pickle
import shutil
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, load_labels  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "model_dengue.json"


def facts():
    """Numbers shown in judge mode, read from the training and Gate 1 reports."""
    out = {}
    tr = HERE / "results" / "train_report.json"
    if tr.exists():
        r = json.load(open(tr, encoding="utf-8"))
        out["train_rows"] = r.get("final_model", {}).get("rows")
        out["train_source"] = "synthetic sentences (claude_draft)"
    g1 = HERE / "results" / "gate1.json"
    if g1.exists():
        g = json.load(open(g1, encoding="utf-8"))
        # Gate 1 ran on the model trained on the 80% split, before the shipped model was refitted on all rows.
        split_rows = json.load(open(tr, encoding="utf-8")).get("train_rows") if tr.exists() else None
        out["gate1"] = {"set": g.get("file"), "rows": g.get("rows"), "micro_f1": g.get("micro_f1"),
                        "model_rows": split_rows}
    return out


def coverage_threshold():
    """Unfamiliar-wording flag threshold from coverage.py (dev split only), or None if not run."""
    p = HERE / "results" / "coverage_threshold.json"
    return json.load(open(p, encoding="utf-8"))["threshold"] if p.exists() else None


def main():
    with open(HERE / "model.pkl", "rb") as f:
        m = pickle.load(f)
    vec, clf, keys = m["vec"], m["clf"], m["keys"]
    labels_json = load_labels()

    coef = np.vstack([e.coef_[0] for e in clf.estimators_])  # labels x features
    intercept = [round(float(e.intercept_[0]), 4) for e in clf.estimators_]
    keep = np.where(np.abs(coef).max(axis=0) >= 1e-4)[0]
    inv = {i: g for g, i in vec.vocabulary_.items()}

    # Dropped n-grams still count towards the L2 norm, so their idf is kept in `idf_norm_only`.
    dropped = [i for i in range(coef.shape[1]) if i not in set(keep.tolist())]
    model = {
        "version": "v0-" + labels_json["version"],
        "labels": keys,
        "vectorizer": {"analyzer": "char_wb", "ngram_range": [2, 5], "sublinear_tf": True, "norm": "l2"},
        "vocab": {inv[i]: n for n, i in enumerate(keep.tolist())},
        "idf": [round(float(vec.idf_[i]), 4) for i in keep],
        "idf_norm_only": {inv[i]: round(float(vec.idf_[i]), 4) for i in dropped},
        "coef": [[round(float(c), 4) for c in row[keep]] for row in coef],
        "intercept": intercept,
        "thresholds": labels_json["bands"],
        "rules_ref": "data/labels_dengue.json version " + labels_json["version"],
        "C": m["C"],
        "facts": facts(),
        "coverage_threshold": coverage_threshold(),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, separators=(",", ":"))
    shutil.copy(OUT, ROOT / "app" / "model_dengue.json")
    # The app reads the same label list and rules, and the facility list (docs/03 CC6).
    shutil.copy(ROOT / "data" / "labels_dengue.json", ROOT / "app" / "labels_dengue.json")
    shutil.copy(ROOT / "data" / "facilities_nazirpur.json", ROOT / "app" / "facilities.json")
    size = OUT.stat().st_size
    print(f"Exported {len(keep)} of {coef.shape[1]} n-grams, {len(keys)} labels")
    print(f"model_dengue.json size: {size:,} bytes ({size / 1024:.1f} KB), target < 500 KB")


if __name__ == "__main__":
    main()
