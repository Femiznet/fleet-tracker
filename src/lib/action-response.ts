import type { ActionResult } from '@/actions/action-result';
import { NextResponse } from 'next/server';

export function actionResponse<T>(
  result: ActionResult<T>,
  successStatus = 200,
) {
  return NextResponse.json(result, {
    status: result.success ? successStatus : result.error.status,
  });
}
