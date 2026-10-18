// Proof that a model ran inside a trusted execution environment (TEE).
// Providers that serve open models in GPU enclaves sign each response with a key that was made
// inside the enclave, and publish an attestation report tying that key to the hardware.
// Here we check three things for every call:
//   1. the signed text is sha256(request):sha256(response), the exact bytes we sent and got back
//   2. the signature recovers to the enclave's signing address (ECDSA, Ethereum-style message)
//   3. the attestation report, fetched with a fresh nonce, names that same signing address
import { createHash, randomBytes } from "node:crypto";
import { verifyMessage } from "ethers";

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

export async function prove(tee, call) {
  const requestHash = sha256(call.request);
  const responseHash = sha256(call.response);
  const proof = { provider: tee.base, model: call.model, id: call.id, requestHash, responseHash };
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
  } catch (err) {
    proof.ok = false;
    proof.error = err.message;
  }
  return proof;
}
