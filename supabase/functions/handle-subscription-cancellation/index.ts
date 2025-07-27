import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { crypto } from 'https://deno.land/std@0.204.0/crypto/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';
// Rate limiting for security
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '../_shared/rateLimiter.ts';

console.log(`🚀 Function 'handle-subscription-cancellation' up and running! (Modern API v1)`);

/**
 * Custom URI component encoder for PayFast signature generation.
 * This version implements the specific encoding rules from PayFast's legacy
 * system, which may still be required for modern API signature generation.
 * @param str The string to encode.
 * @returns The PayFast-compatible encoded string.
 */
function payfastEncode(str: string | number | null | undefined): string {
  if (str === null || typeof str === 'undefined') return '';
  let encoded = encodeURIComponent(String(str));
  encoded = encoded.replace(/%20/g, '+');
  encoded = encoded.replace(/'/g, '%27');
  return encoded;
}

/**
 * Generates a PayFast API signature from a pre-formatted parameter string.
 * @param paramString The pre-formatted, ordered, and encoded parameter string.
 * @returns The MD5 hash signature.
 */
async function generateApiSignature(paramString: string): Promise<string> {
  // Generate the final MD5 hash from the pre-formatted parameter string.
  const dataToHash = new TextEncoder().encode(paramString);
  const hash = await crypto.subtle.digest("MD5", dataToHash);
  const signature = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  
  console.log(`[DEBUG] Final string to hash: ${paramString}`);
  console.log(`[DEBUG] Generated Signature: ${signature}`);
  
  return signature;
}

serve(async (req) => {
  console.log('[MODERN_CANCEL_V1] Executing...');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 🚦 SECURITY: Apply rate limiting for subscription management
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const rateLimitResponse = await applyRateLimit(
    req,
    RATE_LIMIT_CONFIGS.API,
    'subscription-cancellation',
    supabaseUrl,
    supabaseServiceKey
  );
  
  if (rateLimitResponse) {
    console.warn('🚦 Subscription cancellation endpoint rate limited:', req.headers.get('x-forwarded-for') || 'unknown-ip');
    return rateLimitResponse;
  }

  try {
    // --- 1. Validate Environment Variables ---
    const passphrase = Deno.env.get('PAYFAST_SANDBOX_PASSPHRASE')?.trim();
    const merchantId = Deno.env.get('PAYFAST_SANDBOX_MERCHANT_ID')?.trim();

    const secrets = {
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
      merchantId: merchantId,
      passphrase: passphrase,
    };

    const missingSecrets = Object.entries(secrets).filter(([, value]) => !value).map(([key]) => key);
    if (missingSecrets.length > 0) {
      throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
    }

    // --- 2. Initialize Supabase Clients & Get User ---
    const supabaseAdmin = createClient(secrets.supabaseUrl!, secrets.serviceRoleKey!);
    const userClient = createClient(secrets.supabaseUrl!, secrets.anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: getUserError } = await userClient.auth.getUser(accessToken);

    if (getUserError || !user) {
      console.error('[CANCELLATION_ERROR] User not found or invalid token.', getUserError);
      return new Response(JSON.stringify({ error: 'User not found or invalid token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    console.log(`[CANCELLATION_INFO] Authenticated user ${user.id}`);

    // --- 3. Fetch user's subscription token ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('payfast_token, plan_status')
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    if (!profile.payfast_token) throw new Error('Subscription token not found for user.');
    if (profile.plan_status !== 'active') {
        return new Response(JSON.stringify({ error: 'Subscription is not active.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
    console.log(`[CANCELLATION_INFO] Found subscription token ${profile.payfast_token} for user ${user.id}`);

    // --- 4. Call PayFast Modern API to Cancel Subscription ---
    const token = profile.payfast_token;
    const apiUrl = `https://api.payfast.co.za/subscriptions/${token}/cancel?testing=true`;
    
    // Per PayFast support, generate timestamp in SAST (UTC+2)
    const now = new Date();
    const offsetHours = 2;
    const sastDate = new Date(now.getTime() + offsetHours * 3600 * 1000);
    const year = sastDate.getUTCFullYear();
    const month = String(sastDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(sastDate.getUTCDate()).padStart(2, '0');
    const hours = String(sastDate.getUTCHours()).padStart(2, '0');
    const minutes = String(sastDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(sastDate.getUTCSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+02:00`;

    const version = 'v1';

    // Per PayFast support email, the signature string has a fixed order,
    // includes the passphrase directly, and each value is encoded.
    const signatureData = {
      'merchant-id': secrets.merchantId,
      'passphrase': secrets.passphrase,
      'timestamp': timestamp,
      'version': version,
    };

    const orderedKeys = ['merchant-id', 'passphrase', 'timestamp', 'version'];
    const paramString = orderedKeys
      .map(key => `${key}=${payfastEncode(signatureData[key])}`)
      .join('&');

    const signature = await generateApiSignature(paramString);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'merchant-id': secrets.merchantId!,
      'version': version,
      'timestamp': timestamp,
      'signature': signature,
      'Content-Length': '0',
    };

    console.log(`[CANCELLATION_INFO] Calling PayFast Modern API: PUT ${apiUrl}`);
    console.log(`[CANCELLATION_INFO] Sending Headers:\n${JSON.stringify(headers, null, 2)}`);

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: headers,
    });
    
    // --- 5. Process PayFast Response ---
    const responseText = await response.text();
    console.log(`[CANCELLATION_INFO] Raw PayFast API Response (Status: ${response.status}): ${responseText}`);

    if (!response.ok && response.status !== 200) {
        throw new Error(`PayFast API returned an error status: ${response.status}. Body: ${responseText}`);
    }

    let responseData;
    try {
      // Even with 200 OK, the body might be non-JSON or malformed.
      responseData = JSON.parse(responseText);
    } catch (e) {
      // The log from the user shows PayFast can return a 200 OK with a success message that isn't the expected JSON object.
      // If the text contains "success", we can treat it as a successful cancellation.
      if (responseText.toLowerCase().includes('success')) {
        console.log('[CANCELLATION_INFO] Response was not JSON, but contained "success". Treating as successful cancellation.');
        responseData = { status: 'success', data: { message: 'Cancellation processed.' } };
      } else {
        console.error('[CANCELLATION_FATAL] Failed to parse PayFast response as JSON and it did not contain a success message.', e);
        throw new Error(`PayFast API returned an unparsable response: ${responseText}`);
      }
    }

    // --- 6. Update User Profile on Successful Cancellation ---
        const isAlreadyCancelled = responseData.status === 'failed' && responseData.data?.message?.includes('subscription status is cancelled');

    if (responseData.status === 'success' || isAlreadyCancelled) {
      console.log('[CANCELLATION_SUCCESS] PayFast API confirmed cancellation:', responseData.data);
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          plan: 'basic',
          plan_status: 'cancelled',
          payfast_token: null,
          next_billing_date: null,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[CANCELLATION_DB_ERROR] Failed to update user profile after cancellation:', updateError);
        // The subscription is cancelled in PayFast, but our DB failed to update. This is a critical state.
        return new Response(JSON.stringify({ message: 'Subscription cancelled in PayFast, but profile update failed.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 207, // Multi-Status, indicates partial success
        });
      }

      console.log(`[CANCELLATION_COMPLETE] User ${user.id} subscription successfully cancelled and profile updated.`);
      return new Response(JSON.stringify({ message: 'Subscription cancelled successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      console.error('[CANCELLATION_FAILED] PayFast API indicated failure:', responseData);
      throw new Error(`PayFast API returned a failure status: ${JSON.stringify(responseData.data)}`);
    }

  } catch (error) {
    console.error('[CANCELLATION_FATAL]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
