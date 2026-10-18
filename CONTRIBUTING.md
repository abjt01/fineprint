# Contributing to Fineprint

Thanks for helping. Fineprint has one rule above all others: **nothing the model says reaches the user unless code has found it in the document.** Every change should keep that true.

## Setup

```bash
npm install
cp .env.example .env   # GROQ_API_KEY from https://console.groq.com/keys
npm run dev            # http://localhost:4300
npm test
```

You don't need a key to run the tests, the compare page or the verify page.

## Adding a kind of document

Each kind of document is one file in [`lib/packs/`](lib/packs). Copy [`general.js`](lib/packs/general.js) and fill in:

- `keywords`: words that pick this pack automatically (see [`index.js`](lib/packs/index.js)).
- `clauses`: what to read out. Each has a `key`, a `label`, a `unit` (`rs`, `percent`, `months`, `days` or `null`), a `group` (`money` or `terms`, which run as two parallel reads) and a `hint` for the model. Add `cap: true` when the amount is a ceiling on what can be deducted, so money day can check against it.
- `flags(clauses, pages)`: plain-code rules. Use `verified(clauses, pages)` from `util.js` so a rule only sees clauses whose quote was found. Cite a law only when you've checked the section yourself, and say how far it goes.
- `summary(clauses)`: up to three tiles for the top of the results.
- `questions`: three suggested questions for the ask box.

Then register it in `PACKS` in `index.js`, add a test in `test/unit/`, and if you can, add an invented sample to `scripts/make-sample.mjs`.

## Pull requests

- Keep each PR to one change and explain why it's needed.
- `npm test` and `npm run build` must pass. CI runs both on Node 20 and 22.
- Never commit keys, real agreements or anyone's personal details. All samples are invented.
- Write UI text the way a friend would explain a contract: plain words, real numbers, no jargon.

## Reporting a wrong answer

If Fineprint read something wrong, open an issue with the receipt file (you can remove personal details from the quotes). Include what the document actually says and which page it's on. Receipts make these bugs easy to reproduce.
