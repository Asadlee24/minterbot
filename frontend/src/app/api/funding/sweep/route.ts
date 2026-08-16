import { NextRequest, NextResponse } from 'next/server';

// POST /api/funding/sweep
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      message: 'Sweep batch simulated successfully',
      txHashes: []
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
