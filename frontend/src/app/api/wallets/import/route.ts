import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';

// POST /api/wallets/import
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { privateKeys, labelPrefix } = body;

    if (!Array.isArray(privateKeys) || privateKeys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'privateKeys array is required and must not be empty' },
        { status: 400 }
      );
    }

    const wallets = walletStore.import(privateKeys, labelPrefix);
    return NextResponse.json({ success: true, wallets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
