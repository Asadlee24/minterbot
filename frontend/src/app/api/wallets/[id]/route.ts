import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';

// DELETE /api/wallets/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = walletStore.delete(params.id);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
