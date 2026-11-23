import crypto from 'crypto';

/**
 * Deriva una clave de 32 bytes para cifrado AES-256-GCM.
 * Si se define BIOMETRIC_ENCRYPTION_KEY la utiliza; de lo contrario deriva una desde JWT_SECRET.
 */
function getEncryptionKey() {
  const secret = process.env.BIOMETRIC_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-secret-at-least-32-chars-long!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Cifra un texto usando AES-256-GCM (autenticado).
 * Formato resultante: "ivHex:authTagHex:encryptedHex"
 * @param {string} text
 * @returns {string}
 */
export function encryptText(text) {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra un texto cifrado con AES-256-GCM.
 * Compatible hacia atrás: si el texto es JSON plano (empieza con [ o {), lo retorna tal cual.
 * @param {string} cipherText
 * @returns {string} Texto descifrado o el JSON original
 */
export function decryptText(cipherText) {
  if (!cipherText) return null;
  // Compatibilidad hacia atrás si ya existían datos sin cifrar
  if (cipherText.startsWith('[') || cipherText.startsWith('{')) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato cifrado inválido');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Error al descifrar dato biométrico:', err.message);
    throw new Error('Fallo al descifrar dato biométrico');
  }
}
