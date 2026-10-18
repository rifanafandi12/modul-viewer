import { generateToken } from '../services/token.js';

const payload = JSON.parse(process.argv[2] || '{}');
const ttl = Number(process.argv[3] || 60);
console.log(generateToken(payload, ttl));