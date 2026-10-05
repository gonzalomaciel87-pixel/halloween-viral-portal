import { createHash } from 'node:crypto';
export const PRODUCT={id:'halloween-viral',price:0,currency:'ARS',status:'demo-approved'};
export const normalizeEmail=(email='')=>String(email).trim().toLowerCase();
export const emailKey=(email)=>createHash('sha256').update(normalizeEmail(email)).digest('hex');
export function validatePurchase(body={}){return body.product===PRODUCT.id&&Number(body.price)===PRODUCT.price&&body.currency===PRODUCT.currency&&body.status===PRODUCT.status&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(body.email))}
export const entitlementFor=(body)=>({active:true,product:PRODUCT.id,email:normalizeEmail(body.email),name:String(body.name||'').trim(),origin:'demo-checkout',orderedAt:new Date().toISOString(),grantedAt:new Date().toISOString()});
