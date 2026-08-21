async function test() {
  try {
    const email = 'newuser' + Date.now() + '@gmail.com';
    const regRes = await fetch('http://localhost:4000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    console.log("Register:", await regRes.text());

    const loginRes = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.accessToken;
    console.log("Got token:", token.substring(0, 20) + '...');
    
    const meRes = await fetch('http://localhost:4000/users/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log("users/me:", await meRes.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
