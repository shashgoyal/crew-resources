import { NextResponse } from 'next/server';
import { syncProfileToStore, checkProfileExists } from '@/lib/store';
import { supabaseServer } from '@/lib/supabase/server';

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

    if (body.action === 'confirm_email' && body.email) {
      try {
        const { data: usersData } = await supabaseServer.auth.admin.listUsers();
        const targetUser = usersData?.users?.find(u => u.email?.toLowerCase() === body.email.trim().toLowerCase());
        if (targetUser) {
          await supabaseServer.auth.admin.updateUserById(targetUser.id, { email_confirm: true });
          return NextResponse.json({ success: true, confirmed: true });
        }
      } catch (e) {
        console.error("Error auto-confirming email:", e);
      }
      return NextResponse.json({ success: true, confirmed: false });
    }

    const profile = await syncProfileToStore(body);

    if (body.email) {
      try {
        const { data: usersData } = await supabaseServer.auth.admin.listUsers();
        const targetUser = usersData?.users?.find(u => u.email?.toLowerCase() === body.email.trim().toLowerCase());
        if (targetUser && !targetUser.email_confirmed_at) {
          await supabaseServer.auth.admin.updateUserById(targetUser.id, { email_confirm: true });
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error('Error saving profile:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
