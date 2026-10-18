// Proof that a model ran inside a trusted execution environment (TEE).
// Providers that serve open models in GPU enclaves sign each response with a key that was made
// inside the enclave, and publish an attestation report tying that key to the hardware.
// Here we check three things for every call:
//   1. the signed text is sha256(request):sha256(response), the exact bytes we sent and got back
//   2. the signature recovers to the enclave's signing address (ECDSA, Ethereum-style message)
//   3. the attestation report, fetched with a fresh nonce, names that same signing address
import { createHash, randomBytes } from "node:crypto";
import { verifyMessage } from "ethers";
import { tinfoilClient } from "./llm.js";

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

async function getJSON(url, key) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// The pure part, so it can run again later on a receipt with no network: does the signature hold up?
export function checkSignature({ text, signature, signingAddress, requestHash, responseHash }) {
  const parts = String(text || "").split(":");
  const hashesMatch = parts.includes(requestHash) && parts.includes(responseHash);
  let recovered = null;
  try {
    recovered = verifyMessage(text, signature);
  } catch {
    // a malformed signature recovers nothing
  }
  const signerMatches = Boolean(recovered && signingAddress && recovered.toLowerCase() === signingAddress.toLowerCase());
  return { hashesMatch, signerMatches, recovered, ok: hashesMatch && signerMatches };
}

// Tinfoil has no per-reply signature: the proof is that the SDK verified the enclave before connecting
// (its code fingerprint matches the published release) and encrypted the request to that enclave's key.
async function proveTinfoil(tee, call, requestHash, responseHash) {
  const proof = { provider: tee.base, kind: "attested-channel", model: call.model, id: call.id, requestHash, responseHash, response: call.response };
  try {
    const client = await tinfoilClient(tee.key);
    const doc = await client.getVerificationDocument();
    proof.attestation = {
      verifier: doc.verifier ? `${doc.verifier.name}@${doc.verifier.version}` : null,
      configRepo: doc.configRepo,
      releaseTag: doc.releaseTag ?? null,
      releaseDigest: doc.releaseDigest,
      codeFingerprint: doc.codeFingerprint,
      enclaveFingerprint: doc.enclaveFingerprint,
      platform: doc.enclaveMeasurement?.measurement?.type ?? null,
      tlsPublicKey: doc.tlsPublicKey,
      hpkePublicKey: doc.hpkePublicKey,
      securityVerified: doc.securityVerified,
      verifiedAt: doc.verifiedAt ?? null,
      steps: Object.fromEntries(Object.entries(doc.steps || {}).map(([k, v]) => [k, v?.status ?? null])),
    };
    proof.ok = Boolean(doc.securityVerified && doc.codeFingerprint === doc.enclaveFingerprint);
    proof.summary = `Read inside a Tinfoil enclave running ${doc.configRepo}${doc.releaseTag ? ` ${doc.releaseTag}` : ""}, whose code fingerprint matches the public release.`;
  } catch (err) {
    proof.ok = false;
    proof.error = err.message;
  }
  return proof;
}

export async function prove(tee, call) {
  const requestHash = sha256(call.request);
  const responseHash = sha256(call.response);
  if (tee.kind === "tinfoil") return proveTinfoil(tee, call, requestHash, responseHash);
  // the reply is kept so anyone can re-hash it later; the request stays out because it carries the document text
  const proof = { provider: tee.base, model: call.model, id: call.id, requestHash, responseHash, response: call.response };
  try {
    const sig = await getJSON(`${tee.base}/signature/${encodeURIComponent(call.id)}?model=${encodeURIComponent(call.model)}&signing_algo=ecdsa`, tee.key);
    Object.assign(proof, { text: sig.text, signature: sig.signature, signingAddress: sig.signing_address, algo: sig.signing_algo || "ecdsa" });
    Object.assign(proof, { signatureCheck: checkSignature(proof) });

    const nonce = randomBytes(32).toString("hex");
    const report = await getJSON(
      `${tee.base}/attestation/report?model=${encodeURIComponent(call.model)}&nonce=${nonce}&signing_address=${encodeURIComponent(proof.signingAddress)}`,
      tee.key,
    );
    const raw = JSON.stringify(report);
    proof.attestation = {
      nonce,
      digest: sha256(raw),
      namesSigner: raw.toLowerCase().includes(String(proof.signingAddress).toLowerCase().replace(/^0x/, "")),
      bindsNonce: raw.includes(nonce),
      hasGpuEvidence: /nvidia_payload|gpu/i.test(raw),
      hasCpuQuote: /intel_quote|"quote"/i.test(raw),
    };
    proof.ok = proof.signatureCheck.ok && proof.attestation.namesSigner;
    proof.summary = `Signed inside a TEE by ${proof.signingAddress}, the address in the attestation report.`;
  } catch (err) {
    proof.ok = false;
    proof.error = err.message;
  }
  return proof;
}
