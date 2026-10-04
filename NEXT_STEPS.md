# Next steps

Ideas that are outside the current task list go here.

## Proposed 4 Oct, not built (outside docs/03)

- **A. Why-highlight.** Show which words drove each suggested label (tf-idf × coefficient per n-gram, mapped back to the text).
- **B. Unknown-language abstain.** If few of a message's n-grams are in the vocabulary, flag "এই ভাষা চিনি না — ফোন করুন". Threshold from the dev split only. Never remove a suggested label.
- **C. Quantisation.** int8 weights with a per-label scale; report size, max probability difference and band agreement; show inference time in judge mode.
- **D. Learning loop.** Confirm/reject decisions stored on the phone, consent-gated export, `model/retrain.py` that refuses any test-set row and rejects a model that scores lower on the test sets.
