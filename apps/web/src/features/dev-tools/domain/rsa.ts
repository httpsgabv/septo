import { encodeBytes } from './encoding';

export const RSA_SIZES = [2048, 3072, 4096] as const;
export type RsaSize = (typeof RSA_SIZES)[number];

export type RsaKeyPair = { publicKey: string; privateKey: string; bits: RsaSize };

const ALGORITHM = {
  name: 'RSASSA-PKCS1-v1_5',
  hash: 'SHA-256',
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537, what everyone expects
};

/**
 * A key pair straight from WebCrypto, exported as the two PEM blocks people paste elsewhere:
 * SPKI for the public key, PKCS#8 for the private one. Nothing is stored or sent anywhere.
 */
export async function generateRsaKeyPair(bits: RsaSize): Promise<RsaKeyPair> {
  if (!RSA_SIZES.includes(bits)) throw new Error(`Tamanho de chave não suportado: ${bits}`);

  const pair = await crypto.subtle.generateKey({ ...ALGORITHM, modulusLength: bits }, true, [
    'sign',
    'verify',
  ]);

  const [spki, pkcs8] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);

  return {
    bits,
    publicKey: toPem('PUBLIC KEY', spki),
    privateKey: toPem('PRIVATE KEY', pkcs8),
  };
}

export function toPem(label: 'PUBLIC KEY' | 'PRIVATE KEY', der: ArrayBuffer): string {
  const base64 = encodeBytes(new Uint8Array(der), 'base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

// Typed over ArrayBuffer (not ArrayBufferLike) so it can go straight into `crypto.subtle`.
export function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const binary = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
