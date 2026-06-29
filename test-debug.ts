const res = await fetch('http://localhost:3000/api/gemini/debug');
const data = await res.json();
console.log(JSON.stringify(data));
