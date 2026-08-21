const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');

// Encode newlines for .env storage
const privateKeyStr = privateKey.replace(/\r?\n/g, '\\n');
const publicKeyStr = publicKey.replace(/\r?\n/g, '\\n');

if (!env.includes('JWT_PRIVATE_KEY')) {
  env += \nJWT_PRIVATE_KEY="";
  env += \nJWT_PUBLIC_KEY="";
  fs.writeFileSync('.env', env);
  console.log("Keys generated and added to .env");
} else {
  console.log("Keys already exist");
}
