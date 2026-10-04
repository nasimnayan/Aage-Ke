"""Two keyword baselines (docs/03 CC2).

keyword:      a label fires if any of its cues appears as a substring after preprocessing.
keyword+neg:  keyword, plus the same negation and past rules the model uses.

Both return {label: band}, band "sure" or "unsure". Absent labels are dropped.
"""
from preprocess import load_labels
from rules import Rules

_rules = Rules(load_labels())


def keyword(text, rules=_rules):
    return {k: "sure" for k, st in rules.analyse(text).items() if st is not None}


def keyword_neg(text, rules=_rules):
    st = rules.analyse(text)
    out = {}
    for k, s in st.items():
        if s == "plain":
            out[k] = "sure"
        elif s == "past":
            out[k] = "unsure"
    # A negated fever_present becomes fever_dropped.
    if st.get("fever_present") == "neg":
        out.setdefault("fever_dropped", "sure")
    return out


if __name__ == "__main__":
    import sys
    for line in sys.argv[1:]:
        print(line, "| keyword:", keyword(line), "| keyword+neg:", keyword_neg(line))
