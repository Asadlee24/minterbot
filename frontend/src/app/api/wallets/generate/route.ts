import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';

// POST /api/wallets/generate
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { count, labelPrefix } = body;

    if (count !== undefined && (isNaN(Number(count)) || Number(count) < 1)) {
      return NextResponse.json(
        { success: false, error: 'count must be a positive number' },
        { status: 400 }
      );
    }

    const wallets = walletStore.generate(Number(count) || 1, labelPrefix);
    return NextResponse.json({ success: true, wallets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
