import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v1';

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY environment variable is not set'
    );
  }

  const key = Buffer.from(encodedKey, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key'
    );
  }

  return key;
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt an empty credential');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptCredential(encrypted: string): string {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded, extra] =
    encrypted.split('.');

  if (
    version !== VERSION ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded ||
    extra !== undefined
  ) {
    throw new Error('Invalid encrypted credential format');
  }

  const iv = Buffer.from(ivEncoded, 'base64url');
  const authTag = Buffer.from(authTagEncoded, 'base64url');
  const ciphertext = Buffer.from(ciphertextEncoded, 'base64url');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid encrypted credential IV');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
