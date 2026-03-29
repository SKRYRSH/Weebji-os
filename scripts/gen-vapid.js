/**
 * WEEBJI OS — VAPID Key Generator
 * Run once: node scripts/gen-vapid.js
 *
 * Then:
 *  1. Replace VAPID_PK in weebji-os/public/index.html with the printed Public Key
 *  2. In Supabase dashboard → Edge Functions → Secrets, add:
 *       VAPID_PUBLIC_KEY  = <printed public key>
 *       VAPID_PRIVATE_KEY = <printed private key>
 */

const { subtle } = globalThis.crypto ?? require('crypto').webcrypto;

async function generate() {
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );

  const [pubRaw, privJwk] = await Promise.all([
    subtle.exportKey('raw', keyPair.publicKey),
    subtle.exportKey('jwk', keyPair.privateKey),
  ]);

  const toBase64Url = (buf) => Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const publicKey  = toBase64Url(pubRaw);
  // VAPID private key = raw 32-byte scalar encoded as base64url (d field of JWK)
  const privateKey = privJwk.d;

  console.log('\n══════════════════════════════════════════════');
  console.log('  WEEBJI OS — VAPID Keys (generated once)');
  console.log('══════════════════════════════════════════════');
  console.log('\nPublic Key (paste into index.html VAPID_PK):');
  console.log(publicKey);
  console.log('\nPrivate Key (add to Supabase secrets as VAPID_PRIVATE_KEY):');
  console.log(privateKey);
  console.log('\nAlso add to Supabase secrets as VAPID_PUBLIC_KEY:');
  console.log(publicKey);
  console.log('\n══════════════════════════════════════════════\n');
}

generate().catch(console.error);
