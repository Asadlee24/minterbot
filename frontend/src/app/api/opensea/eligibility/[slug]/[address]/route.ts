import { NextRequest, NextResponse } from 'next/server';

// GET /api/opensea/eligibility/[slug]/[address]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; address: string }> }
) {
  try {
    const { slug, address } = await params;
    return NextResponse.json({
      success: true,
      snapshot: {
        wallet: address,
        minterQuantityMinted: 0,
        stages: [
          {
            stageType: 'PUBLIC',
            stageIndex: 0,
            isEligible: true,
            eligiblePriceNativeWei: '0',
            eligiblePriceSymbol: 'ETH',
            maxTotalMintableByWallet: 10
          }
        ]
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
