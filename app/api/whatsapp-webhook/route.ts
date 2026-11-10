import { NextRequest, NextResponse, connection } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * Universal Meta WhatsApp Cloud API Webhook Router.
 * Handles unlimited clinic branches through a single endpoint.
 * Dynamically resolves branch context from metadata.phone_number_id.
 */

export async function GET(req: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      process.env.META_VERIFY_TOKEN ||
      'healthsync_secure_webhook_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Forbidden: Invalid Verify Token', { status: 403 });
  } catch (err: any) {
    return new Response(`Error: ${err?.message || 'Server error'}`, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();

    // 1. Validate Meta WhatsApp Payload structure
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    if (!change || !change.messages || change.messages.length === 0) {
      // Event may be a delivery/read receipt (statuses)
      return NextResponse.json({ status: 'ignored_or_status_ack' }, { status: 200 });
    }

    const recipientPhoneId = change.metadata?.phone_number_id;
    const incomingMessage = change.messages[0];
    const senderPhone = incomingMessage.from; // Patient's phone with country code (e.g. 919847012345)
    const senderProfileName = change.contacts?.[0]?.profile?.name || 'Patient';

    if (!recipientPhoneId || !senderPhone) {
      return NextResponse.json({ error: 'Missing phone metadata' }, { status: 400 });
    }

    // 2. DYNAMIC BRANCH RESOLUTION (Meta phone_number_id -> clinic_locations)
    let { data: loc } = await supabase
      .from('clinic_locations')
      .select('*')
      .eq('whatsapp_phone_number_id', recipientPhoneId)
      .eq('is_active', true)
      .maybeSingle();

    // Fallback: If phone_number_id is not yet registered, route to primary branch
    if (!loc) {
      const { data: defaultLoc } = await supabase
        .from('clinic_locations')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      loc = defaultLoc;
    }

    const branchName = loc?.branch_name || 'HealthSync Medical Center';
    const branchCode = loc?.branch_code || loc?.id || 'HS-MAIN';
    const locationId = loc?.id || null;

    // 3. Extract Message Content (Text or Audio)
    const msgType = incomingMessage.type;
    let messageBody = '';
    let isAudio = false;

    if (msgType === 'text') {
      messageBody = incomingMessage.text?.body?.trim() || '';
    } else if (msgType === 'audio' || msgType === 'voice') {
      messageBody = '[Voice Note]';
      isAudio = true;
    } else if (msgType === 'interactive') {
      messageBody = incomingMessage.interactive?.button_reply?.title || incomingMessage.interactive?.list_reply?.title || '';
    }

    // 4. Record WhatsApp Inbound Request in Supabase
    try {
      await supabase.from('whatsapp_requests').insert([
        {
          phone_number: senderPhone,
          patient_name: senderProfileName,
          status: 'Received',
          raw_payload: {
            message_type: msgType,
            message_body: messageBody,
            recipient_phone_id: recipientPhoneId,
            branch_id: locationId,
            branch_name: branchName,
            branch_code: branchCode,
          },
        },
      ]);
    } catch (logErr) {
      console.warn('Logging to whatsapp_requests failed:', logErr);
    }

    // 5. Build Dynamic Automated Reply
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://healthsync.in';
    const bookingUrl = `${appBaseUrl}/book?branch=${encodeURIComponent(branchCode)}&phone=${encodeURIComponent(senderPhone)}`;

    let replyMessage = '';
    if (isAudio) {
      replyMessage = `Namaskaram ${senderProfileName}!\n\nWe received your voice note at *${branchName}*.\nOur desk is processing your request.\n\nTo reserve your consultation slot immediately, please tap below:\n${bookingUrl}`;
    } else {
      replyMessage = `Namaskaram ${senderProfileName}!\n\nWelcome to *${branchName}*.\n\nToday's OPD and token consultation slots are currently available.\n\n👉 *Book Your Slot Online:* \n${bookingUrl}\n\nEmergency Helpline: ${loc?.phone || '+91 98470 12345'}`;
    }

    // 6. Send Response via Meta Cloud API if Token is configured
    const whatsappToken =
      process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_TOKEN ||
      process.env.META_ACCESS_TOKEN;

    if (whatsappToken && recipientPhoneId) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${recipientPhoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: senderPhone,
            type: 'text',
            text: { body: replyMessage },
          }),
        });
      } catch (metaSendErr) {
        console.warn('Direct Meta WhatsApp send error:', metaSendErr);
      }
    }

    return NextResponse.json({
      status: 'routed_success',
      branch: branchName,
      branch_code: branchCode,
      location_id: locationId,
      sender: senderPhone,
    });
  } catch (err: any) {
    console.error('WhatsApp webhook fatal error:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}

