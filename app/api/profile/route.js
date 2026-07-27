import { NextResponse } from 'next/server';
import { syncProfileToStore, checkProfileExists } from '@/lib/store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const staffId = searchParams.get('staff_id');

    const result = await checkProfileExists(email, staffId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.action === 'check') {
      const result = await checkProfileExists(body.email, body.staff_id);
      return NextResponse.json({ success: true, ...result });
    }

    const profile = await syncProfileToStore(body);
    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error('Error saving profile:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
