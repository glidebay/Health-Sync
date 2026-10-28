import { NextRequest, NextResponse } from 'next/server';



export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get('media_id');
    const fallbackUrl = searchParams.get('url');

    if (!mediaId && !fallbackUrl) {
      return NextResponse.json(
        { error: 'Missing media_id or url parameter' },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://agupndzcqjofnmkhgsqc.supabase.co';
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const whatsappToken =
      process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_TOKEN ||
      process.env.META_ACCESS_TOKEN;

    // 1. If WhatsApp permanent access token is configured, try direct Meta Cloud API download
    if (mediaId && whatsappToken) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
          },
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (metaData?.url) {
            const audioRes = await fetch(metaData.url, {
              headers: {
                Authorization: `Bearer ${whatsappToken}`,
                'User-Agent': 'HealthSync-WhatsApp-Proxy/1.0',
              },
            });
            if (audioRes.ok) {
              const audioBuffer = await audioRes.arrayBuffer();
              return new NextResponse(audioBuffer, {
                status: 200,
                headers: {
                  'Content-Type': metaData.mime_type || 'audio/ogg; codecs=opus',
                  'Content-Length': String(audioBuffer.byteLength),
                  'Accept-Ranges': 'bytes',
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
                },
              });
            }
          }
        }
      } catch (metaErr) {
        console.warn('[WhatsApp Audio Proxy] Direct Meta fetch error:', metaErr);
      }
    }

    // 2. Try fetching from Supabase Edge Function whatsapp-webhook
    if (mediaId) {
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?media_id=${mediaId}`;
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'HealthSync-WhatsApp-Proxy/1.0',
        };
        if (supabaseKey) {
          headers['apikey'] = supabaseKey;
          headers['Authorization'] = `Bearer ${supabaseKey}`;
        }

        const edgeRes = await fetch(edgeFunctionUrl, {
          method: 'GET',
          headers,
        });

        if (edgeRes.ok) {
          const contentType = edgeRes.headers.get('content-type') || 'audio/ogg; codecs=opus';
          // Verify that this is real audio binary and not plain text error
          if (!contentType.includes('text/') && !contentType.includes('json')) {
            const buffer = await edgeRes.arrayBuffer();
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(buffer.byteLength),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
              },
            });
          }
        }
      } catch (edgeErr) {
        console.warn('[WhatsApp Audio Proxy] Supabase Edge Function fetch error:', edgeErr);
      }
    }

    // 3. Fallback: If direct media URL is provided, try downloading it
    if (fallbackUrl) {
      const safeUrl = fallbackUrl.replace(/^http:\/\//i, 'https://');
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'HealthSync-WhatsApp-Proxy/1.0',
        };
        if (whatsappToken) {
          headers['Authorization'] = `Bearer ${whatsappToken}`;
        }

        const fallbackRes = await fetch(safeUrl, { headers });
        if (fallbackRes.ok) {
          const contentType = fallbackRes.headers.get('content-type') || 'audio/ogg; codecs=opus';
          if (!contentType.includes('text/') && !contentType.includes('json')) {
            const buffer = await fallbackRes.arrayBuffer();
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(buffer.byteLength),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
              },
            });
          }
        }
      } catch (fallbackErr) {
        console.warn('[WhatsApp Audio Proxy] Direct fallback URL fetch error:', fallbackErr);
      }
    }

    // 4. Return diagnostic error response
    return NextResponse.json(
      {
        error: 'Audio file expired or not found on Meta CDN',
        mediaId: mediaId || null,
        message:
          'WhatsApp Cloud API temporary access tokens expire after 24 hours and media download URLs expire after 5-30 minutes. If this voice note was sent earlier, it may have expired on Meta servers.',
      },
      {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: unknown) {
    console.error('[WhatsApp Audio Proxy] Internal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal audio proxy error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}