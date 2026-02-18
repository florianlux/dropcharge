#!/usr/bin/env node
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-strong-password"');
  process.exit(1);
}

const rounds = parseInt(process.env.ADMIN_HASH_ROUNDS || '12', 10);
(async () => {
  const hash = await bcrypt.hash(password, rounds);
  console.log(hash);
})();
