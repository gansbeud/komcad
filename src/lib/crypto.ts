/**
 * Cryptography Utilities
 * Password hashing, token hashing, and encryption helpers
 * Uses Web Crypto API (available in Cloudflare Workers)
 */

/**
 * Hash a password using PBKDF2-SHA256 (100,000 iterations)
 * Compatible with Node.js crypto.pbkdf2Sync()
 * Returns base64(salt + derivedKey)
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt (16 bytes)
  const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
  
  // Convert password to uint8array
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as PBKDF2 key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // PBKDF2 derivation (100,000 iterations, output 256 bits = 32 bytes)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );
  
  // Combine salt + derivedKey and encode as base64
  const derivedKeyBytes = new Uint8Array(derivedBits);
  const combined = new Uint8Array([...saltBuffer, ...derivedKeyBytes]);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 * Constant-time comparison to prevent timing attacks
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Decode the hash
    const combined = new Uint8Array(atob(hash).split('').map(c => c.charCodeAt(0)));
    
    // Extract salt (first 16 bytes) and storedDerivedKey (remaining bytes)
    const saltBuffer = combined.slice(0, 16);
    const storedDerivedKey = combined.slice(16);
    
    // Hash the provided password with the extracted salt
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Import password as PBKDF2 key
    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // PBKDF2 derivation with the stored salt
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256
    );
    
    const derivedKeyBytes = new Uint8Array(derivedBits);
    
    // Constant-time comparison
    if (derivedKeyBytes.length !== storedDerivedKey.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < derivedKeyBytes.length; i++) {
      result |= derivedKeyBytes[i] ^ storedDerivedKey[i];
    }
    
    return result === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Hash a JWT token using SHA-256
 * Store this in the database instead of the plaintext token
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const tokenBuffer = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a secure random token (base64-encoded)
 * Useful for password reset tokens, CSRF tokens, etc.
 */
export function generateSecureToken(lengthBytes: number = 32): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(lengthBytes));
  return btoa(String.fromCharCode(...randomBytes));
}

/**
 * Create a JWT token (basic implementation)
 * Note: This is a simplified JWT. For production, use a proper JWT library
 */
export async function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number = 28800 // 8 hours default
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerEncoded = btoa(JSON.stringify(header));
  const payloadEncoded = btoa(JSON.stringify(claims));

  const message = `${headerEncoded}.${payloadEncoded}`;
  const encoder = new TextEncoder();
  const messageBuffer = encoder.encode(message);
  const secretBuffer = encoder.encode(secret);

  const keyBuffer = await crypto.subtle.importKey('raw', secretBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', keyBuffer, messageBuffer);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureEncoded = btoa(String.fromCharCode(...signatureArray));

  return `${message}.${signatureEncoded}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: Record<string, unknown>; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

    // Verify signature
    const message = `${headerEncoded}.${payloadEncoded}`;
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const secretBuffer = encoder.encode(secret);

    const keyBuffer = await crypto.subtle.importKey('raw', secretBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureBuffer = new Uint8Array(atob(signatureEncoded).split('').map(c => c.charCodeAt(0)));

    const isValid = await crypto.subtle.verify('HMAC', keyBuffer, signatureBuffer, messageBuffer);
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const payloadJSON = atob(payloadEncoded);
    const payload = JSON.parse(payloadJSON) as Record<string, unknown>;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if ((payload.exp as number) < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: `JWT verification failed: ${error}` };
  }
}
