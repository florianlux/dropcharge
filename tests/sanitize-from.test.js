const { sanitizeFrom } = require('../netlify/functions/_lib/email-from');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

// Valid plain email
assert('plain email', sanitizeFrom('noreply@dropcharge.de'), 'noreply@dropcharge.de');

// Valid Name <email>
assert('name + email', sanitizeFrom('DropCharge <noreply@dropcharge.de>'), 'DropCharge <noreply@dropcharge.de>');

// Extra whitespace around
assert('trimmed name + email', sanitizeFrom('  DropCharge <noreply@dropcharge.de>  '), 'DropCharge <noreply@dropcharge.de>');

// Name only (the bug scenario) → should return null
assert('name only returns null', sanitizeFrom('DropCharge'), null);

// Empty / null / undefined
assert('null input', sanitizeFrom(null), null);
assert('undefined input', sanitizeFrom(undefined), null);
assert('empty string', sanitizeFrom(''), null);
assert('whitespace only', sanitizeFrom('   '), null);

// Control characters stripped
assert('newline in value', sanitizeFrom('DropCharge <noreply@dropcharge.de>\n'), 'DropCharge <noreply@dropcharge.de>');
assert('tab in value', sanitizeFrom('DropCharge\t<noreply@dropcharge.de>'), 'DropCharge <noreply@dropcharge.de>');

// Non-string input
assert('number input', sanitizeFrom(123), null);
assert('object input', sanitizeFrom({}), null);

// Name with extra spaces before bracket
assert('extra spaces before bracket', sanitizeFrom('DropCharge   <noreply@dropcharge.de>'), 'DropCharge <noreply@dropcharge.de>');

// Email without name in brackets
assert('email in brackets no name', sanitizeFrom('<noreply@dropcharge.de>'), 'noreply@dropcharge.de');

// TLD too short (single char) should be rejected
assert('single char TLD rejected', sanitizeFrom('user@domain.c'), null);
assert('single char TLD in name format rejected', sanitizeFrom('Name <user@domain.c>'), null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
