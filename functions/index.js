import { unlockStatic } from './_unlock.js';
// 홈(/) — 정적 home.html을 함수가 서빙하며 발송된 호 잠금해제.
export async function onRequestGet({ env, request }) {
  return unlockStatic(env, request, '/home.html', 'index.html');
}
