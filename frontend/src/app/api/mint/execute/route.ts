import { NextRequest, NextResponse } from 'next/server';

// POST /api/mint/execute
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { collectionSlug, mode, quantityPerWallet, chainId, walletIds } = body;

    if (!collectionSlug) {
      return NextResponse.json(
        { success: false, error: 'collectionSlug is required' },
        { status: 400 }
      );
    }

    const count = Array.isArray(walletIds) ? walletIds.length : 1;

    return NextResponse.json({
      success: true,
      message: `Mint session initiated for ${count} wallet(s) on ${collectionSlug} (${mode || 'single'} mode).`,
      sessionId: `session_${Date.now()}`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
