// Supabase Edge Function: generate-payfast-payment-data
import { createClient } from 'npm:@supabase/supabase-js@2';
// Deno Standard Library for MD5 hashing
import { crypto } from 'https://deno.land/std@0.204.0/crypto/mod.ts';
import { encode } from 'https://deno.land/std@0.204.0/encoding/hex.ts';
// Rate limiting for security
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '../_shared/rateLimiter.ts';


console.log('generate-payfast-payment-data function invoked');

// CORS headers - adjust as necessary for your client application
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or your specific client origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Generates a PayFast-compliant URL-encoded string.
 * 1. Encodes the string using the standard `encodeURIComponent`.
 * 2. Replaces spaces (`%20`) with plus signs (`+`).
 * 3. Manually encodes apostrophes (`'`) as `%27`, which `encodeURIComponent` misses.
 */
function payfastEncode(str: string | number | null | undefined): string {
    // Final, correct encoding logic based on all evidence.
    if (str === null || typeof str === 'undefined') return '';
    let encoded = encodeURIComponent(String(str));

    // Rule 1: Replace space with '+' (which encodeURIComponent does as %20)
    encoded = encoded.replace(/%20/g, '+');

    // Rule 2: Manually encode apostrophe, as encodeURIComponent misses it.
    encoded = encoded.replace(/'/g, '%27');

    return encoded;
}

Deno.serve(async (req: Request) => {
  console.log('--- generate-payfast-payment-data: Function invoked ---');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request for generate-payfast-payment-data...');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 🚦 SECURITY: Apply strict rate limiting for payment endpoints
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const rateLimitResponse = await applyRateLimit(
    req,
    RATE_LIMIT_CONFIGS.PAYMENT,
    'payment-generation',
    supabaseUrl,
    supabaseServiceKey
  );
  
  if (rateLimitResponse) {
    console.warn('🚦 Payment endpoint rate limited:', req.headers.get('x-forwarded-for') || 'unknown-ip');
    return rateLimitResponse;
  }

  try {
    // The client is sending a JSON-stringified body. To parse it robustly,
    // we read the raw text of the request and then parse it as JSON.
    const requestText = await req.text();
    const body = JSON.parse(requestText);
    const typeOfFullName = typeof body.fullName;
    console.log('Request body received:', { ...body, typeOfFullName, rawBody: body });

    // Destructure the parameters from the request body
    const { userId, email, fullName, isInitialSetup, itemName, amount, itemDescription } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!fullName) { // This will be true for null, undefined, or ""
      return new Response(JSON.stringify({ error: 'Missing or empty required parameter: fullName' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (typeof isInitialSetup === 'undefined') {
      return new Response(JSON.stringify({ error: 'Missing required parameter: isInitialSetup' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // --- Payfast Configuration - SECURE: No hardcoded fallbacks ---
    const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_SANDBOX_MERCHANT_ID');
    const PAYFAST_MERCHANT_KEY = Deno.env.get('PAYFAST_SANDBOX_MERCHANT_KEY');
    const PAYFAST_PASSPHRASE = Deno.env.get('PAYFAST_SANDBOX_PASSPHRASE');
    
    // Validate that all required PayFast credentials are present
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY || !PAYFAST_PASSPHRASE) {
      console.error('Missing required PayFast credentials in environment variables');
      return new Response(JSON.stringify({ 
        error: 'Server configuration error: Payment service credentials not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    
    const PAYFAST_PAYMENT_URL = 'https://sandbox.payfast.co.za/eng/process';
    // Dynamically determine the base URL from the request origin for redirects.
    // This ensures that redirects work in both local development and production.
    const origin = req.headers.get('origin');
    let baseUrl = 'https://groundschool-ai.vercel.app'; // Default to production
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      baseUrl = origin; // Use the localhost origin for local development
    }

    const RETURN_URL = `${baseUrl}/home`;
    const CANCEL_URL = `${baseUrl}/home`;
    // TODO: Replace <YOUR_PROJECT_REF> with your actual Supabase project reference
    // For example: https://xyzabcdefghijklmnopqrst.supabase.co/functions/v1/handle-payfast-itn
    const SUPABASE_PROJECT_REF = Deno.env.get('PROJECT_REF'); // e.g., xyzabcdefghijklmnopqrst
    if (!SUPABASE_PROJECT_REF) {
      console.error('PROJECT_REF environment variable is not set.');
      throw new Error('Server configuration error: Supabase project reference not found.');
    }
    const NOTIFY_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/handle-payfast-itn`;

    const ITEM_NAME = "Captain's Club Subscription";
    const ITEM_AMOUNT = "99.00"; // Format: 123.45

    // Generate a unique merchant payment ID
    const m_payment_id = crypto.randomUUID();

    // --- Store m_payment_id for this attempt on the user's profile ---
    // These environment variables are typically injected by Supabase when deployed or running locally via `supabase start`
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase URL or Service Role Key environment variables.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Cannot connect to database.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check if the user is already subscribed
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Ignore 'exact one row' error if profile is just not found
      console.error(`Error fetching profile for user ${userId}:`, profileError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve user profile.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (profile && profile.plan === 'captains_club') {
      console.log(`User ${userId} is already subscribed to Captain's Club. Aborting payment generation.`);
      return new Response(JSON.stringify({ error: 'User is already subscribed to this plan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ m_payment_id_last_attempt: m_payment_id })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error(`Error updating profile for user ${userId} with m_payment_id_last_attempt ${m_payment_id}:`, profileUpdateError);
      // Depending on policy, you might want to halt payment if this fails
      return new Response(JSON.stringify({ error: 'Failed to record payment attempt. Please try again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal server error
      });
    }
    console.log(`Successfully updated profile for user ${userId} with m_payment_id_last_attempt: ${m_payment_id}`);

    // --- Construct Data for Payfast (including signature generation) ---

    // Prepare billing_date (today in YYYY-MM-DD format)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const billingDate = `${year}-${month}-${day}`;

    // Handle splitting fullName into calculatedFirstName and calculatedLastName
    let calculatedFirstName = fullName || ''; // Use fullName from reqBody
    let calculatedLastName = ''; 
    const nameParts = fullName?.trim().split(' ') || [];
    if (nameParts.length > 1) {
      calculatedFirstName = nameParts.slice(0, -1).join(' ');
      calculatedLastName = nameParts.slice(-1).join('');
    } else if (nameParts.length === 1) {
      calculatedFirstName = nameParts[0];
      // calculatedLastName remains empty. Our signature logic currently omits empty strings.
      // If Payfast requires `lastName=` in the signature for an empty last name, the signature loop needs adjustment.
    }
    console.log(`Parsed name: firstName='${calculatedFirstName}', lastName='${calculatedLastName}'`);

    let paymentParams: { [key: string]: any }; // Declare paymentParams

    if (isInitialSetup) {
      // STEP 1: Tokenization Setup (No Charge)
      console.log('Processing STEP 1: Tokenization Setup')
      paymentParams = {
        merchant_id: PAYFAST_MERCHANT_ID,
        merchant_key: PAYFAST_MERCHANT_KEY,
        return_url: RETURN_URL,
        cancel_url: CANCEL_URL,
        notify_url: NOTIFY_URL,
        
        name_first: calculatedFirstName,
        name_last: calculatedLastName,
        email_address: email,
        cell_number: '', // Added as per Payfast signature requirements
        email_confirmation: '', // Added based on Payfast 'Key fields for signature'
        confirmation_address: '', // Added based on Payfast 'Key fields for signature'
        payment_method: '', // Added based on Payfast 'Key fields for signature'

        m_payment_id: m_payment_id,
        amount: '0.00', 
        item_name: 'Captain\'s Club - Setup',
        item_description: 'Subscription setup for Captain\'s Club membership',
        
        subscription_type: '2', // CRITICAL: 2 = tokenization payment
        
        custom_str1: 'captains-club', 
        custom_str2: 'tokenization_setup',
        custom_str3: email
      };
    } else {
      // STEP 2: Regular subscription with immediate charge
      console.log('Processing STEP 2: Subscription Charge')
      
      const amount = ITEM_AMOUNT; 
      const currentDate = new Date().toISOString().split('T')[0] 
      
      paymentParams = {
        merchant_id: PAYFAST_MERCHANT_ID,
        merchant_key: PAYFAST_MERCHANT_KEY,
        return_url: RETURN_URL,
        cancel_url: CANCEL_URL,
        notify_url: NOTIFY_URL,
        
        name_first: calculatedFirstName,
        name_last: calculatedLastName,
        email_address: email,
        
        m_payment_id: m_payment_id,
        amount: amount,
        item_name: ITEM_NAME,
        item_description: `First payment for ${ITEM_NAME}`,
        
        subscription_type: '1', // 1 = subscription
        billing_date: currentDate,
        recurring_amount: amount,
        frequency: '3', // 3 = Monthly
        cycles: '0', // 0 = indefinite
        custom_str1: userId, // CRITICAL: Pass userId for ITN handler
      };
    }

    const PAYFAST_PARAMETER_ORDER = [
      'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
      'name_first', 'name_last', 'email_address', 'cell_number',
      'm_payment_id', 'amount', 'item_name', 'item_description',
      'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
      'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
      'email_confirmation', 'confirmation_address',
      'payment_method', 'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles'
    ];

    // Build the query string for the signature
    const signatureQueryString = PAYFAST_PARAMETER_ORDER
      .filter(key => paymentParams[key] !== undefined && paymentParams[key] !== null && paymentParams[key] !== '')
      .map(key => `${key}=${payfastEncode(paymentParams[key])}`)
      .join('&');

    // Append the passphrase and generate the MD5 hash
    const finalStringToHash = `${signatureQueryString}&passphrase=${PAYFAST_PASSPHRASE}`;
    // Use Web Crypto API for MD5 hashing
    const signatureDigest = await crypto.subtle.digest(
      "MD5",
      new TextEncoder().encode(finalStringToHash),
    );
    // Convert the ArrayBuffer to a hex string (lowercase)
    const signature = Array.from(new Uint8Array(signatureDigest), b => b.toString(16).padStart(2, '0')).join('').toLowerCase();

    // Prepare the final parameters to send to the client
    const formDataForClient: { [key: string]: any } = {};
    for (const key in paymentParams) {
      // We only include parameters that have a value
      if (paymentParams[key] !== '' && paymentParams[key] !== null && paymentParams[key] !== undefined) {
        formDataForClient[key] = paymentParams[key];
      }
    }
    // Add the generated signature to the form data
    formDataForClient['signature'] = signature;

    console.log('Data for client:', { paymentUrl: PAYFAST_PAYMENT_URL, formData: formDataForClient });

    return new Response(
      JSON.stringify({ 
        paymentUrl: PAYFAST_PAYMENT_URL, 
        formData: formDataForClient 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-payfast-payment-data:', error);
    // Ensure error.message is stringified properly
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/*
Example of how to call this function from your client:

async function initiatePayment() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('User not authenticated');
      // Handle not authenticated error
      return;
    }

    const user = session.user;
    const profile = await getProfile(); // You'll need a function to get the user's profile for firstName

    if (!profile) {
        console.error('User profile not found');
        return;
    }

    const response = await fetch('https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/generate-payfast-payment-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': '<YOUR_SUPABASE_ANON_KEY>' // Supabase Edge Functions are often protected by anon key or service_role key
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        firstName: profile.first_name, // Assuming 'first_name' is the column in your profiles table
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Payfast data:', result);
      // result.paymentUrl is the URL to POST to
      // result.formData contains all key-value pairs for the form
      // Now construct and submit a form in a WebView
      // e.g., openWebView(result.paymentUrl, result.formData);
    } else {
      console.error('Error generating Payfast data:', result.error);
      // Handle error, show message to user
    }
  } catch (e) {
    console.error('Payment initiation failed:', e);
    // Handle error
  }
}

*/
