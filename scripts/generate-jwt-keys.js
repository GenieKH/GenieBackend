// Generates an RS256 key pair and prints it as .env lines.
// Usage: node scripts/generate-jwt-keys.js
// Nothing is written to disk: copy the output into your .env / hosting secrets.
const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const toEnvValue = (pem) => pem.trim().replace(/\r?\n/g, '\\n');

console.log(`JWT_PRIVATE_KEY="${toEnvValue(privateKey)}"`);
console.log(`JWT_PUBLIC_KEY="${toEnvValue(publicKey)}"`);
