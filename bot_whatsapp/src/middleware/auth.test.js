import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { jwtAuth } from './auth.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
async function check(header, response) {
  globalThis.fetch = async () => response;
  const result = { statusCode: 200, next: false };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await jwtAuth({ headers: { authorization: header } }, res, () => { result.next = true; });
  return result;
}
test('missing and invalid tokens are rejected', async () => {
  assert.equal((await check(undefined)).statusCode, 401);
  assert.equal((await check('Bearer forged', { status: 401 })).statusCode, 401);
});
for (const role of ['admin', 'finance', 'sales', 'kolektor', 'teknisi']) {
  test(`bot management access for ${role}`, async () => {
    const result = await check('Bearer token', { ok: true, json: async () => ({ user: { role } }) });
    assert.equal(result.next, role === 'admin');
    assert.equal(result.statusCode, role === 'admin' ? 200 : 403);
  });
}
test('backend failure cannot grant access', async () => {
  assert.equal((await check('Bearer token', { ok: false, status: 500 })).statusCode, 503);
  globalThis.fetch = async () => { throw new Error('offline'); };
  let status;
  await jwtAuth({ headers: { authorization: 'Bearer token' } }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('must deny'));
  assert.equal(status, 503);
});
