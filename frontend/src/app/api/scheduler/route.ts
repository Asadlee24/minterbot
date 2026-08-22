import { NextRequest, NextResponse } from 'next/server';
import { schedulerStore } from '../../../lib/schedulerStore';

// GET /api/scheduler
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get('x-client-session-id') || 'default_session';
    const scheduler = schedulerStore.get(sessionId);
    return NextResponse.json({ success: true, scheduler });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
