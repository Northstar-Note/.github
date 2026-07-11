import { unlockStatic } from '../_unlock.js';
// 발행목록(/issues/) — 정적 list.html을 함수가 서빙하며 발송된 호 잠금해제.
export async function onRequestGet({ env, request }) {
  return unlockStatic(env, request, '/issues/list.html', 'issues/index.html');
}
