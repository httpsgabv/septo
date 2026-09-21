import { describe, expect, it } from 'vitest';
import { generateRsaKeyPair, pemToBytes, RSA_SIZES } from './rsa';

describe('generateRsaKeyPair', () => {
  it('writes both keys as PEM, wrapped at 64 columns', async () => {
    const pair = await generateRsaKeyPair(2048);

    expect(pair.publicKey.startsWith('-----BEGIN PUBLIC KEY-----\n')).toBe(true);
    expect(pair.publicKey.trimEnd().endsWith('-----END PUBLIC KEY-----')).toBe(true);
    expect(pair.privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true);
    expect(pair.privateKey.trimEnd().endsWith('-----END PRIVATE KEY-----')).toBe(true);

    const body = pair.privateKey.split('\n').slice(1, -2);
    expect(body.every((line) => line.length <= 64)).toBe(true);
    expect(body.slice(0, -1).every((line) => line.length === 64)).toBe(true);
  });

  it('produces keys the browser can import back — the proof that the PEM is real', async () => {
    const pair = await generateRsaKeyPair(2048);
    const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

    const publicKey = await crypto.subtle.importKey(
      'spki',
      pemToBytes(pair.publicKey),
      algorithm,
      true,
      ['verify'],
    );
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(pair.privateKey),
      algorithm,
      true,
      ['sign'],
    );

    expect((publicKey.algorithm as RsaHashedKeyAlgorithm).modulusLength).toBe(2048);
    expect(privateKey.type).toBe('private');

    // The pair belongs together: what one signs, the other verifies.
    const message = new TextEncoder().encode('septo');
    const signature = await crypto.subtle.sign(algorithm.name, privateKey, message);
    expect(await crypto.subtle.verify(algorithm.name, publicKey, signature, message)).toBe(true);
  }, 20_000);

  it('offers exactly the three sizes and refuses anything else', async () => {
    expect(RSA_SIZES).toEqual([2048, 3072, 4096]);
    // @ts-expect-error a size outside the union is exactly what this guards against
    await expect(generateRsaKeyPair(1024)).rejects.toThrow(/1024/);
  });
});

describe('pemToBytes', () => {
  it('reads a PEM back into the bytes it was written from', () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nAP8Q\n-----END PUBLIC KEY-----\n';
    expect(Array.from(pemToBytes(pem))).toEqual([0, 255, 16]);
  });
});
