import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../lib/walletStore';

// DELETE /api/wallets/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = req.headers.get('x-client-session-id') || 'default_session';
    const ok = walletStore.delete(id, sessionId);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
