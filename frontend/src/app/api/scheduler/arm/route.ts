import { NextRequest, NextResponse } from 'next/server';
import { schedulerStore } from '../../../../lib/schedulerStore';

// POST /api/scheduler/arm
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, expectedStartTime, chainId, quantity, mode, walletIds } = body;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
    }
    if (!expectedStartTime || isNaN(Date.parse(expectedStartTime))) {
      return NextResponse.json({ success: false, error: 'expectedStartTime must be a valid ISO date' }, { status: 400 });
    }
    if (new Date(expectedStartTime) <= new Date()) {
      return NextResponse.json({ success: false, error: 'expectedStartTime must be in the future' }, { status: 400 });
    }
    if (!chainId || isNaN(Number(chainId))) {
      return NextResponse.json({ success: false, error: 'chainId is required' }, { status: 400 });
    }
    if (!Array.isArray(walletIds) || walletIds.length === 0) {
      return NextResponse.json({ success: false, error: 'walletIds must be a non-empty array' }, { status: 400 });
    }

    const scheduler = schedulerStore.arm({
      slug: slug.trim().toLowerCase(),
      expectedStartTime,
      chainId: Number(chainId),
      quantity: Number(quantity) || 1,
      mode: mode || 'self-funded',
      walletIds
    });

    return NextResponse.json({ success: true, scheduler });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
