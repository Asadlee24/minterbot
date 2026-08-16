import { NextRequest, NextResponse } from 'next/server';

// GET /api/opensea/collection/[slug]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const DEFAULT_SITE_URL = process.env.OPENSEA_SITE_URL || 'https://opensea.io';
    const DEFAULT_GRAPHQL_URL = process.env.OPENSEA_GRAPHQL_URL || 'https://gql.opensea.io/graphql';
    const APP_ID = process.env.OPENSEA_APP_ID || 'os2-web';

    const query = `
      query MintCollectionMetadata($slug: String!) {
        collectionBySlug(slug: $slug) {
          slug
          address
          chain { identifier networkId }
          drop {
            stages {
              stageType
              stageIndex
              startTime
              endTime
              maxTotalMintableByWallet
            }
          }
        }
      }
    `;

    const res = await fetch(DEFAULT_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': APP_ID,
        'Origin': DEFAULT_SITE_URL,
        'Referer': `${DEFAULT_SITE_URL}/collection/${slug}`
      },
      body: JSON.stringify({
        operationName: 'MintCollectionMetadata',
        query,
        variables: { slug }
      })
    });

    const json = await res.json().catch(() => ({}));
    const collection = json?.data?.collectionBySlug;

    if (!collection) {
      // Fallback mock metadata for testing if OpenSea GraphQL is unreachable
      return NextResponse.json({
        success: true,
        metadata: {
          slug,
          address: '0x0000000000000000000000000000000000000000',
          chainIdentifier: 'BASE_SEPOLIA',
          networkId: 84532,
          stages: [
            { stageType: 'PUBLIC', stageIndex: 0, maxTotalMintableByWallet: 10 }
          ]
        }
      });
    }

    return NextResponse.json({
      success: true,
      metadata: {
        slug: collection.slug,
        address: collection.address,
        chainIdentifier: collection.chain?.identifier || 'BASE_SEPOLIA',
        networkId: Number(collection.chain?.networkId || 84532),
        stages: collection.drop?.stages || [{ stageType: 'PUBLIC', stageIndex: 0 }]
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
