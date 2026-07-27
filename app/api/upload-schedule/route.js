import { NextResponse } from 'next/server';
import { addScheduleToStore } from '@/lib/store';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No PDF file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const staffId = formData.get('staff_id');
    const currentUserProfile = staffId ? { staff_id: staffId } : null;

    const result = await addScheduleToStore(buffer, file.name, currentUserProfile);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error parsing uploaded schedule:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
