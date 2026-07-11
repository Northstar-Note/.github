import { unlockStatic } from './_unlock.js';
// 홈(/) — 발송된 호 히어로/카드 잠금해제, 미발송은 그대로.
export async function onRequestGet({ env, request }) {
  return unlockStatic(env, request, '/index.html', 'index.html');
}
