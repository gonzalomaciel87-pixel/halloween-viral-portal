export function normalizeBuyerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidBuyerEmail(value) {
  const email = normalizeBuyerEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isAdminEmail(email, configuredAdmin) {
  return normalizeBuyerEmail(email) === normalizeBuyerEmail(configuredAdmin);
}
