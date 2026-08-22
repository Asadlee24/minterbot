import { NextRequest, NextResponse } from 'next/server';
import { schedulerStore } from '../../../../lib/schedulerStore';

// GET /api/scheduler/logs
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const logs = schedulerStore.getLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
