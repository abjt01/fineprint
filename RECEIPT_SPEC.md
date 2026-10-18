# Receipt format, version 1

A receipt is one JSON file that records what an AI said about a document, with enough evidence for anyone to check it later without running a model. This app writes them, and the `/verify` page checks them. The format is small on purpose, so other tools can write and check receipts too.

## Top level

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | number | `1` |
| `app` | string | `"receipts"` |
| `kind` | string | `"review"` (clauses read from a contract), `"answer"` (a question answered) or `"factcheck"` (another AI's claims checked) |
| `pack` | string or null | For reviews: `rent`, `job`, `loan`, `insurance` or `general` |
| `question` | string or null | For answers: the question asked |
| `text` | string or null | For fact-checks: the text that was checked |
| `createdAt` | ISO 8601 string | When the receipt was made |
| `document` | object | `name`, `sha256` (of the PDF bytes), `pages` (count), `pageHashes` (sha256 of each page's extracted text, in order) |
| `clauses` | array | The claims, below |
| `flags` | array | For reviews: `{ level: "red" \| "amber" \| "info", title, detail, keys, law }`, worked out by code from verified clauses |
| `summary` | array | For reviews: `{ label, value, sub }` tiles |
| `tee` | array or null | Enclave proofs, below. `null` when the model didn't run in a TEE |
| `digest` | hex string | sha256 of the canonical JSON of every other field |

## A clause

| Field | Meaning |
| --- | --- |
| `key`, `label` | What it is (`deposit`, "Security deposit"), or for answers and fact-checks, `s1`/`c1` and the sentence |
| `unit` | `rs`, `percent`, `months`, `days` or `null` |
| `found` | Whether the document covers it |
| `verdict` | Fact-checks only: `supported`, `contradicted` or `not_found` |
| `answer` | The plain-language reading |
| `value` | One number in `unit`, or `null` |
| `quote`, `page` | The exact line the reading rests on, and its page |
| `check` | `{ status: "verified" \| "check" \| "missing", page, match, why }`, the result of finding the quote in the PDF |
| `tries` | `2` when the model had to be shown the page and asked again |
| `model` | Which model read it |
| `audit` | `{ agrees, note, model }` from the second model, or `null` |

## An enclave proof

| Field | Meaning |
| --- | --- |
| `provider`, `model`, `id` | Where the call went, and the provider's id for it |
| `requestHash`, `responseHash` | sha256 of the exact request body sent and response body received |
| `response` | The response body itself, so its hash and its clauses can be checked. The request isn't stored because it contains the document's text |
| `text`, `signature`, `signingAddress`, `algo` | What the enclave signed (`requestHash:responseHash`, sometimes prefixed with the model), its ECDSA signature (Ethereum signed-message style) and the enclave's address |
| `attestation` | `nonce` (fresh, random), `digest` (sha256 of the report), and whether the report names the signing address and carries GPU and CPU evidence |

## Canonical JSON and the digest

Keys are sorted at every level, fields whose value is `undefined` are dropped, and there is no whitespace. `digest = sha256(canonical(receipt without digest))`.

## Checking a receipt

With only the receipt:

1. Recompute the digest. A mismatch means the file was edited.
2. For each clause with a `value` in `rs` or `percent`, that number must appear in its own `quote`.
3. For each enclave proof: the signature must recover to `signingAddress`; `text` must contain both hashes; `sha256(response)` must equal `responseHash`; and each clause's value and quote must match what the signed response said.

With the PDF too:

4. `sha256(pdf)` must equal `document.sha256`.
5. Every found clause's quote must be found again on its page.

None of these steps needs a model, a network call or this app's server. See [`lib/receipt.js`](lib/receipt.js) for the reference checker.
