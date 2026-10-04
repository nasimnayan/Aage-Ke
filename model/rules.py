"""Cue matching plus negation and past-tense rules (labels_dengue.json -> rules).

Shared by the keyword+neg baseline and by the model. Mirrored in app/rules.js.

For each label, analyse() returns one of:
  None    no cue for the label in the message
  "neg"   every clause that mentions it is negated: suppress
  "past"  remaining mentions are all past: band is "not sure" (warning signs only)
  "plain" at least one current, non-negated mention
"""
from preprocess import preprocess, label_keys

WARNING, STATUS = "warning", "status"


class Rules:
    def __init__(self, labels_json):
        r = labels_json["rules"]
        word_breaks = []
        self.char_breaks = []
        for b in r["clause_breaks"]:
            p = preprocess(b)
            if p:
                word_breaks.append(p)
            else:
                self.char_breaks.append(b)
        self.word_breaks = set(word_breaks)
        self.neg = [preprocess(x).split() for x in r["negation_cues_bn"] + r["negation_cues_banglish"]]
        self.past = [preprocess(x).split() for x in r["past_cues_bn"] + r["past_cues_banglish"]]
        self.past_endings = [preprocess(x) for x in r["past_verb_endings"]]
        self.stop = [preprocess(x) for x in r["stop_words"]]
        self.window = r["negation_window_tokens"]

        self.keys = label_keys(labels_json)
        self.kind, self.cues, self.exclude = {}, {}, {}
        for group, kind in (("warning_signs", WARNING), ("status_labels", STATUS)):
            for lab in labels_json[group]:
                k = lab["key"]
                self.kind[k] = kind
                raw = lab.get("cues_bn", []) + lab.get("cues_banglish", []) + lab.get("cues_regional", [])
                cues = sorted({preprocess(c) for c in raw if preprocess(c)}, key=len, reverse=True)
                self.cues[k] = cues
                self.exclude[k] = [preprocess(x) for x in lab.get("exclude_phrases", [])]

    # Clauses: split the raw text on break characters first, then on break words (whole tokens).
    def clauses(self, text):
        parts = [text or ""]
        for b in self.char_breaks:
            parts = [q for p in parts for q in p.split(b)]
        out = []
        for p in parts:
            cur = []
            for tok in preprocess(p).split():
                if tok in self.word_breaks:
                    if cur:
                        out.append(cur)
                    cur = []
                else:
                    cur.append(tok)
            if cur:
                out.append(cur)
        return out

    def _matches(self, key, tokens):
        """Token spans (start, end inclusive) where a cue of `key` occurs as a substring."""
        s = " ".join(tokens)
        for ex in self.exclude[key]:
            # Mask exclude phrases (e.g. "rokto porikkha") so bleeding cannot fire on them.
            s = s.replace(ex, "#" * len(ex))
        spans = []
        for cue in self.cues[key]:
            i = s.find(cue)
            while i != -1:
                a = s.count(" ", 0, i)
                b = s.count(" ", 0, i + len(cue) - 1)
                spans.append((a, b))
                i = s.find(cue, i + 1)
        return spans

    @staticmethod
    def _seq_at(tokens, i, seq):
        return tokens[i:i + len(seq)] == seq

    def _neg_positions(self, tokens):
        pos = set()
        for i in range(len(tokens)):
            for seq in self.neg:
                if self._seq_at(tokens, i, seq):
                    pos.update(range(i, i + len(seq)))
        return pos

    def _is_past(self, tokens):
        for i, t in enumerate(tokens):
            if any(t.endswith(e) for e in self.past_endings):
                return True
            if any(self._seq_at(tokens, i, seq) for seq in self.past):
                return True
        return False

    def _span_negated(self, tokens, span, negpos):
        a, b = span
        for n in negpos:
            if a <= n <= b:
                continue  # negation inside the cue (e.g. "prosrab hocche na") does not count
            if a - self.window <= n < a:
                between = tokens[n + 1:a]
            elif b < n <= b + self.window:
                between = tokens[b + 1:n]
            else:
                continue
            # "bomi bondho hocche na" = vomiting does not stop: keep the label.
            if any(t.startswith(s) for t in between for s in self.stop):
                continue
            return True
        return False

    def analyse(self, text):
        clauses = self.clauses(text)
        info = [(c, self._neg_positions(c), self._is_past(c)) for c in clauses]
        out = {}
        for k in self.keys:
            mentions = []  # per clause: "neg" | "past" | "plain"
            for tokens, negpos, past in info:
                spans = self._matches(k, tokens)
                if not spans:
                    continue
                if past and self.kind[k] == WARNING:
                    mentions.append("past")  # past wins over negation
                elif all(self._span_negated(tokens, sp, negpos) for sp in spans):
                    mentions.append("neg")
                else:
                    mentions.append("plain")
            if not mentions:
                out[k] = None
            elif all(m == "neg" for m in mentions):
                out[k] = "neg"
            elif all(m in ("neg", "past") for m in mentions):
                out[k] = "past"
            else:
                out[k] = "plain"
        return out


def band(p, bands):
    if p >= bands["suggest"]:
        return "sure"
    if p >= bands["unsure_low"]:
        return "unsure"
    return None


_RANK = {None: 0, "unsure": 1, "sure": 2}


def apply_rules(probs, status, bands):
    """Model probabilities {label: p} + rule status {label: ...} -> {label: band}.

    neg suppresses; past forces "not sure" (never dropped, ambiguity goes to a person);
    a negated fever_present becomes fever_dropped (at least "not sure").
    """
    out = {}
    for k, p in probs.items():
        st = status.get(k)
        if st == "neg":
            continue
        b = "unsure" if st == "past" else band(p, bands)
        if b:
            out[k] = b
    if status.get("fever_present") == "neg":
        b = max(out.get("fever_dropped"), band(probs["fever_present"], bands), "unsure", key=_RANK.get)
        out["fever_dropped"] = b
    return out


def outcome(bands_by_label, warning_keys):
    """Message outcome for the inbox: 'labels', 'not_understood' or 'no_warning_sign'."""
    if not bands_by_label:
        return "not_understood"
    if not any(k in warning_keys for k in bands_by_label) and set(bands_by_label) <= {"feeling_better", "fever_dropped"}:
        return "no_warning_sign"
    return "labels"
