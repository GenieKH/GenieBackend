const jwt = require('jsonwebtoken');

async function test() {
  try {
    const token = jwt.sign({ sub: '50647bb2-e356-44b9-9f1c-fc672caa0f66', role: 'user' }, 'super-secret-fallback-key', { expiresIn: '15m' });
    console.log("Testing /users/me...");
    const meRes = await fetch('http://localhost:4000/users/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log("users/me status:", meRes.status);
    console.log("headers:");
    meRes.headers.forEach((val, key) => {
      console.log(key + ':', val);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
