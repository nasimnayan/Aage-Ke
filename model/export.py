"""Export the trained model to JSON for the browser (docs/03 CC3).

{version, labels, vocab: {ngram: index}, idf: [...], coef: [[...]], intercept: [...], thresholds, rules_ref}
Weights rounded to 4 decimals. Vocab entries whose coefficients are all below 1e-4 are dropped.
Writes model/model_dengue.json and a copy in app/ for the PWA.
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
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, separators=(",", ":"))
    shutil.copy(OUT, ROOT / "app" / "model_dengue.json")
    size = OUT.stat().st_size
    print(f"Exported {len(keep)} of {coef.shape[1]} n-grams, {len(keys)} labels")
    print(f"model_dengue.json size: {size:,} bytes ({size / 1024:.1f} KB), target < 500 KB")


if __name__ == "__main__":
    main()
