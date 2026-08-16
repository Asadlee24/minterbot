import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../lib/walletStore';

// GET /api/wallets — list all wallets
export async function GET(req: NextRequest) {
  try {
    const fast = req.nextUrl.searchParams.get('fast') === 'true';
    const records = walletStore.getAll();

    const wallets = records
      .map((rec) => ({
        id: rec.id,
        address: rec.address,
        label: rec.label,
        createdAt: rec.createdAt,
        // balances are not fetched in the Next.js route to keep it simple & fast
        balances: {}
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ success: true, wallets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
