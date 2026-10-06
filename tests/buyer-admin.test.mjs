import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail, isValidBuyerEmail, normalizeBuyerEmail } from '../netlify/lib/buyer-admin.mjs';

test('normaliza correos de compradores', () => {
  assert.equal(normalizeBuyerEmail('  LeticiaPuerta989@GMAIL.com '), 'leticiapuerta989@gmail.com');
});

test('valida correos y restringe la administración', () => {
  assert.equal(isValidBuyerEmail('cliente@gmail.com'), true);
  assert.equal(isValidBuyerEmail('correo incorrecto'), false);
  assert.equal(isAdminEmail('ADMIN@GMAIL.COM', 'admin@gmail.com'), true);
  assert.equal(isAdminEmail('cliente@gmail.com', 'admin@gmail.com'), false);
});
