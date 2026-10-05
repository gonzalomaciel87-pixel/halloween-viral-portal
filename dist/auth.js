import { init, oauthLogin, handleAuthCallback, getCurrentUser, logout } from 'https://esm.sh/@netlify/identity@2.1.0';
const status=document.querySelector('#login-status');await init();async function route(user){if(!user){return}const roles=user?.app_metadata?.roles||[];if(roles.includes('buyer'))location.href='/portal';else if(status)status.textContent='Esta cuenta está autenticada, pero todavía no tiene acceso de comprador.'}
try{const callback=await handleAuthCallback();await route(callback?.user||getCurrentUser())}catch(error){if(status)status.textContent='No pudimos completar el acceso. Intentá nuevamente.'}
document.querySelector('#google-login')?.addEventListener('click',()=>oauthLogin('google'));
document.querySelector('#logout')?.addEventListener('click',async()=>{await logout();location.href='/login.html'});
