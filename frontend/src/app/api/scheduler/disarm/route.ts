import { NextRequest, NextResponse } from 'next/server';
import { schedulerStore } from '../../../../lib/schedulerStore';

// POST /api/scheduler/disarm
export async function POST(req: NextRequest) {
  try {
    const sessionId = req.headers.get('x-client-session-id') || 'default_session';
    const scheduler = schedulerStore.disarm(sessionId);
    return NextResponse.json({ success: true, scheduler });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
