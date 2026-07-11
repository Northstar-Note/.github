import { unlockStatic } from '../_unlock.js';
// 발행목록(/issues/) — 발송된 호 카드만 클릭 가능(전문 읽기), 미발송은 '곧 공개'.
export async function onRequestGet({ env, request }) {
  return unlockStatic(env, request, '/issues/index.html', 'issues/index.html');
}
