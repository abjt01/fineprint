# Security policy

## Reporting a vulnerability

Please don't open a public issue for security problems. Use GitHub's private [security advisory form](https://github.com/abjt01/fineprint/security/advisories/new) instead. You should get a reply within a few days.

## What counts

- Ways to make the verify page accept a receipt that was changed, or one that points at quotes that aren't in the PDF.
- Ways to make a flag or a money-day result come from text that isn't in the document.
- Ways to read another person's uploaded document, or to get around the rate limits.
- Anything that exposes API keys.

## How documents and keys are handled

- Uploaded PDFs are kept in memory for an hour so you can ask follow-up questions. They are never written to disk.
- With TEE mode on, the document is encrypted to an enclave whose code was checked against its published release before anything was sent.
- The second-opinion model only sees short quotes, never the whole document.
- API keys live only in `.env` or the host's environment. They are never in the repo or the Docker image.
