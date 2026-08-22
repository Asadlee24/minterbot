import { NextResponse } from 'next/server';
import { schedulerStore } from '../../../../lib/schedulerStore';

// POST /api/scheduler/disarm
export async function POST() {
  try {
    const scheduler = schedulerStore.disarm();
    return NextResponse.json({ success: true, scheduler });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
