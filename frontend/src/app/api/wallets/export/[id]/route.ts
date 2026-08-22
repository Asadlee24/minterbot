import { NextRequest, NextResponse } from 'next/server';
import { walletStore } from '../../../../../lib/walletStore';

// GET /api/wallets/export/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = req.headers.get('x-client-session-id') || 'default_session';
    const fallbackEncryptedKey = req.nextUrl.searchParams.get('encryptedKey') || undefined;
    const privateKey = walletStore.getDecryptedPrivateKey(id, fallbackEncryptedKey, sessionId);
    return NextResponse.json({ success: true, privateKey });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
