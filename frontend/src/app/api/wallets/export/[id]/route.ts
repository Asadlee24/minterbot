import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../../lib/walletStore';

// GET /api/wallets/export/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const privateKey = walletStore.getDecryptedPrivateKey(id);
    return NextResponse.json({ success: true, privateKey });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
