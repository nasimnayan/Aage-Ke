"""rules.py vs app/rules.js, and full model+rules output, Python vs Node.

Run: python model/test_rules_parity.py
"""
import json
import pickle
import subprocess
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, preprocess, load_labels  # noqa: E402
from rules import Rules  # noqa: E402
from train import system_predict  # noqa: E402
from test_cc2 import HAND  # noqa: E402

JS = (
    "const M=require(process.argv[1]),R=require(process.argv[2]),model=require(process.argv[3]),"
    "L=require(process.argv[4]);const r=new R.Rules(L);let d='';process.stdin.setEncoding('utf8');"
    "process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);process.stdout.write(JSON.stringify("
    "a.map(t=>{const st=r.analyse(t);return [st,R.applyRules(M.predict(model,t),st,L.bands)];})));});"
)


def main():
    labels = load_labels()
    rules = Rules(labels)
    with open(Path(__file__).resolve().parent / "model.pkl", "rb") as f:
        m = pickle.load(f)
    texts = pd.read_csv(ROOT / "data" / "train_sentences.csv", keep_default_na=False)["text"].astype(str).tolist()
    texts += [t for t, _, _ in HAND]
    app = ROOT / "app"
    res = subprocess.run(
        ["node", "-e", JS, str(app / "model.js"), str(app / "rules.js"), str(app / "model_dengue.json"),
         str(app / "labels_dengue.json")],
        input=json.dumps(texts).encode("utf-8"), capture_output=True, check=True,
    )
    js = json.loads(res.stdout.decode("utf-8"))
    probs = m["clf"].predict_proba(m["vec"].transform([preprocess(t) for t in texts]))
    py_sys = system_predict(texts, probs, m["keys"], rules, labels["bands"])
    bad_rules = [t for t, (st, _) in zip(texts, js) if st != rules.analyse(t)]
    bad_sys = [(t, s, j[1]) for t, s, j in zip(texts, py_sys, js) if s != j[1]]
    print(f"{len(texts)} texts: rules mismatches {len(bad_rules)}, model+rules mismatches {len(bad_sys)}")
    for x in (bad_rules + bad_sys)[:5]:
        print("  ", x)
    sys.exit(1 if bad_rules or bad_sys else 0)


if __name__ == "__main__":
    main()
