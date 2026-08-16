import { NextRequest, NextResponse } from 'next/server';

// GET /api/health
export async function GET() {
  return NextResponse.json({ status: 'OK', timestamp: new Date().toISOString() });
}
