"""Train the label model (docs/03 CC3). Test files are never read here.

TF-IDF character n-grams + one-vs-rest logistic regression. C is chosen on the dev split
by micro-F1 of model+rules. Writes model/model.pkl (for export.py) and results/train_report.json.
"""
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from sklearn.multiclass import OneVsRestClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, preprocess, load_labels, label_keys  # noqa: E402
from rules import Rules, apply_rules  # noqa: E402

HERE = Path(__file__).resolve().parent
SEED = 42


def load_train():
    d = pd.read_csv(ROOT / "data" / "train_sentences.csv", keep_default_na=False)
    verified = d["verified"].astype(str).str.lower() == "true"
    draft = d["source"] == "claude_draft"
    counts = {"verified": int(verified.sum()), "claude_draft_unverified": int((draft & ~verified).sum())}
    d = d[verified | draft].reset_index(drop=True)
    return d, counts


def to_sets(series):
    return [set(x for x in s.split("|") if x) for s in series]


def to_matrix(sets, keys):
    return np.array([[1 if k in s else 0 for k in keys] for s in sets])


def system_predict(texts, probs, keys, rules, bands):
    """Model+rules: list of {label: band}."""
    out = []
    for t, p in zip(texts, probs):
        out.append(apply_rules(dict(zip(keys, p)), rules.analyse(t), bands))
    return out


def fit(texts, y, C):
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), max_features=4000, sublinear_tf=True)
    X = vec.fit_transform([preprocess(t) for t in texts])
    clf = OneVsRestClassifier(LogisticRegression(class_weight="balanced", max_iter=2000, C=C))
    clf.fit(X, y)
    return vec, clf


def main():
    labels_json = load_labels()
    keys = label_keys(labels_json)
    rules = Rules(labels_json)
    bands = labels_json["bands"]

    d, counts = load_train()
    primary = d["labels"].map(lambda s: s.split("|")[0] if s else "none")
    tr, dev = train_test_split(d, test_size=0.2, stratify=primary, random_state=SEED)
    y_tr = to_matrix(to_sets(tr["labels"]), keys)
    y_dev = to_matrix(to_sets(dev["labels"]), keys)

    scores = {}
    for C in (0.5, 1, 2, 4):
        vec, clf = fit(tr["text"].tolist(), y_tr, C)
        probs = clf.predict_proba(vec.transform([preprocess(t) for t in dev["text"]]))
        pred = to_matrix(system_predict(dev["text"].tolist(), probs, keys, rules, bands), keys)
        scores[C] = f1_score(y_dev, pred, average="micro", zero_division=0)
        print(f"C={C}: dev micro-F1 (model+rules) = {scores[C]:.3f}")
    best_C = max(scores, key=scores.get)

    # Refit on train only so the dev split stays clean for threshold checks.
    vec, clf = fit(tr["text"].tolist(), y_tr, best_C)
    probs = clf.predict_proba(vec.transform([preprocess(t) for t in dev["text"]]))
    pred = to_matrix(system_predict(dev["text"].tolist(), probs, keys, rules, bands), keys)
    per_label = f1_score(y_dev, pred, average=None, zero_division=0)

    with open(HERE / "model.pkl", "wb") as f:
        pickle.dump({"vec": vec, "clf": clf, "keys": keys, "C": best_C}, f)

    report = {
        "rows_used": counts, "train_rows": len(tr), "dev_rows": len(dev),
        "C_scores": {str(k): round(v, 4) for k, v in scores.items()}, "best_C": best_C,
        "dev_micro_f1": round(float(scores[best_C]), 4),
        "dev_per_label_f1": {k: round(float(v), 4) for k, v in zip(keys, per_label)},
        "vocab_size": len(vec.vocabulary_),
    }
    (HERE / "results").mkdir(exist_ok=True)
    with open(HERE / "results" / "train_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Rows: {counts['verified']} verified + {counts['claude_draft_unverified']} claude_draft (unverified)")
    print(f"Train {len(tr)} / dev {len(dev)}. Best C={best_C}, dev micro-F1 {scores[best_C]:.3f}")
    for k, v in report["dev_per_label_f1"].items():
        print(f"  {k:24s} {v:.3f}")


if __name__ == "__main__":
    main()
