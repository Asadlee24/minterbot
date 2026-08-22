import { NextResponse } from 'next/server';
import { schedulerStore } from '../../../lib/schedulerStore';

// GET /api/scheduler
export async function GET() {
  try {
    const scheduler = schedulerStore.get();
    return NextResponse.json({ success: true, scheduler });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
