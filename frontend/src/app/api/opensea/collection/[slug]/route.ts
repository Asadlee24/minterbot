import { NextRequest, NextResponse } from 'next/server';

function mapChainToNetworkId(chainStr: string): { chainIdentifier: string; networkId: number } {
  const normalized = (chainStr || '').toLowerCase();
  if (normalized.includes('robinhood') || normalized.includes('hood')) {
    if (normalized.includes('testnet') || normalized.includes('sepolia')) {
      return { chainIdentifier: 'ROBINHOOD_TESTNET', networkId: 46630 };
    }
    return { chainIdentifier: 'ROBINHOOD_CHAIN', networkId: 4663 };
  }
  if (normalized.includes('base') && !normalized.includes('sepolia')) {
    return { chainIdentifier: 'BASE', networkId: 8453 };
  }
  if (normalized.includes('ethereum') || normalized.includes('mainnet')) {
    return { chainIdentifier: 'ETHEREUM', networkId: 1 };
  }
  if (normalized.includes('arbitrum')) {
    return { chainIdentifier: 'ARBITRUM', networkId: 42161 };
  }
  if (normalized.includes('polygon')) {
    return { chainIdentifier: 'POLYGON', networkId: 137 };
  }
  if (normalized.includes('sepolia')) {
    return { chainIdentifier: 'BASE_SEPOLIA', networkId: 84532 };
  }
  return { chainIdentifier: chainStr.toUpperCase() || 'EVM', networkId: 8453 };
}

// GET /api/opensea/collection/[slug]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.trim().toLowerCase();

    // Strategy 1: OpenSea Public REST API v2
    try {
      const apiRes = await fetch(`https://api.opensea.io/api/v2/collections/${cleanSlug}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const contract = data?.contracts?.[0] || {};
        const rawChain = contract.chain || data?.pricing_currencies?.listing_currency?.chain || (cleanSlug.includes('hood') ? 'robinhood' : 'base');
        const { chainIdentifier, networkId } = mapChainToNetworkId(rawChain);

        return NextResponse.json({
          success: true,
          metadata: {
            slug: cleanSlug,
            name: data.name || cleanSlug,
            address: contract.address || '0x0000000000000000000000000000000000000000',
            chainIdentifier,
            networkId,
            stages: [{ stageType: 'PUBLIC', stageIndex: 0 }]
          }
        });
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 2: HTML Scrape of OpenSea collection page
    try {
      const htmlRes = await fetch(`https://opensea.io/collection/${cleanSlug}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(5000)
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const pushIdx = html.indexOf('.push(');
        if (pushIdx !== -1) {
          const start = pushIdx + 6;
          const end = html.indexOf(')</script>', start);
          const parsed = JSON.parse(html.slice(start, end));
          const col = (Object.values(parsed?.rehydrate || {})?.[0] as any)?.data?.collectionBySlug;
          if (col) {
            const rawChain = col.chain?.identifier || col.contracts?.[0]?.chain?.identifier || (cleanSlug.includes('hood') ? 'robinhood' : 'base');
            const { chainIdentifier, networkId } = mapChainToNetworkId(rawChain);

            // Extract contract address from contracts array or HTML regex match
            let address = col.contracts?.[0]?.address;
            if (!address) {
              const match = html.match(/\/item\/[^\/]+\/(0x[a-fA-F0-9]{40})/i) || html.match(/(0x[a-fA-F0-9]{40})/i);
              if (match) {
                address = match[1];
              }
            }

            return NextResponse.json({
              success: true,
              metadata: {
                slug: cleanSlug,
                address: address || '0x0000000000000000000000000000000000000000',
                chainIdentifier,
                networkId,
                stages: col.drop?.stages || [{ stageType: 'PUBLIC', stageIndex: 0 }]
              }
            });
          }
        }
      }
    } catch {
      // Continue to fallback
    }

    // Strategy 3: Default fallback
    const isHood = cleanSlug.includes('hood') || cleanSlug.includes('robin');
    const { chainIdentifier, networkId } = mapChainToNetworkId(isHood ? 'robinhood' : 'base');

    return NextResponse.json({
      success: true,
      metadata: {
        slug: cleanSlug,
        address: '0x0000000000000000000000000000000000000000',
        chainIdentifier,
        networkId,
        stages: [{ stageType: 'PUBLIC', stageIndex: 0 }]
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

