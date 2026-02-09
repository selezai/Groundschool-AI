import { createClient } from 'npm:@supabase/supabase-js@2'
// Rate limiting for webhook security
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '../_shared/rateLimiter.ts';

console.log('PayFast ITN Handler starting...');

// ============================================================================
// SECURITY: PayFast IP Allowlist
// PayFast sends ITN notifications from specific IP ranges.
// See: https://developers.payfast.co.za/docs#step-4-confirm-payment-source
// ============================================================================
const PAYFAST_ALLOWED_IPS = [
  // PayFast Production IPs
  '197.97.145.144/28',   // 197.97.145.144 - 197.97.145.159
  '41.74.179.192/27',    // 41.74.179.192 - 41.74.179.223
  // PayFast Sandbox IPs (for testing)
  '197.97.145.144/28',
  '41.74.179.192/27',
];

// Helper to check if IP is in CIDR range
function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipToInt = (ipStr: string): number => {
    const parts = ipStr.split('.').map(Number);
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  };
  
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

// Check if request IP is from PayFast
function isPayFastIP(ip: string): boolean {
  // Skip IP validation in development/sandbox mode if configured
  const skipIpValidation = Deno.env.get('PAYFAST_SKIP_IP_VALIDATION') === 'true';
  if (skipIpValidation) {
    console.log('[SECURITY] IP validation skipped (development mode)');
    return true;
  }
  
  for (const cidr of PAYFAST_ALLOWED_IPS) {
    if (ipInCidr(ip, cidr)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// SECURITY: Structured Request Logging
// ============================================================================
interface SecurityLog {
  timestamp: string;
  event: string;
  ip: string;
  userAgent: string;
  paymentId?: string;
  userId?: string;
  status: 'success' | 'failure' | 'blocked' | 'warning';
  details?: Record<string, unknown>;
}

function logSecurityEvent(log: SecurityLog): void {
  console.log(JSON.stringify({
    type: 'SECURITY_EVENT',
    ...log,
  }));
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// PayFast configuration - SECURE: Validate required credentials
const PAYFAST_MERCHANT_ID = Deno.env.get('PAYFAST_SANDBOX_MERCHANT_ID')
const PAYFAST_PASSPHRASE = Deno.env.get('PAYFAST_SANDBOX_PASSPHRASE')

// Validate PayFast credentials are present
if (!PAYFAST_MERCHANT_ID || !PAYFAST_PASSPHRASE) {
  console.error('Missing required PayFast credentials in environment variables');
  throw new Error('PayFast credentials not configured');
}

// Custom URL encoder for PayFast signature validation
function payfastEncode(str: string | number | null | undefined): string {
  if (str === null || typeof str === 'undefined') return '';
  let encoded = encodeURIComponent(String(str));
  encoded = encoded.replace(/%20/g, '+');
  encoded = encoded.replace(/'/g, '%27');
  return encoded;
}

// Working MD5 implementation
function md5(str: string): string {
  // Convert string to array of little-endian words
  function str2binl(str: string): number[] {
    const bin: number[] = [];
    for (let i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & 255) << (i % 32);
    }
    return bin;
  }

  // Convert array of little-endian words to hex string
  function binl2hex(binarray: number[]): string {
    const hexTab = '0123456789abcdef';
    let str = '';
    for (let i = 0; i < binarray.length * 4; i++) {
      str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
             hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
    }
    return str;
  }

  // Add integers, wrapping at 2^32
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  // Bitwise rotate a 32-bit number to the left
  function bitRotateLeft(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  // These functions implement the four basic operations the algorithm uses
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }

  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  const x = str2binl(str);
  const len = str.length * 8;

  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = md5ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

    a = md5ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return binl2hex([a, b, c, d]);
}

// Generate MD5 signature
function generateApiSignature(paramString: string): string {
  const signature = md5(paramString);
  console.log(`[DEBUG] Final string to hash: ${paramString}`);
  console.log(`[DEBUG] Generated Signature: ${signature}`);
  return signature;
}

// Validate PayFast ITN signature
// Fields that PayFast excludes from ITN signature calculation
// CRITICAL: Only exclude 'signature' field - PayFast includes token and billing_date!
const EXCLUDED_ITN_FIELDS = new Set([
  'signature',     // Always excluded - this is the signature we're validating
]);

/**
 * Comprehensive PayFast ITN Signature Debugger
 */
function debugPayFastSignature(rawBody: string, passphrase: string): void {
  console.log('\n=== PAYFAST SIGNATURE DEBUG ===');
  console.log('Raw body length:', rawBody.length);
  console.log('Raw body:', rawBody);
  
  // CRITICAL: Work with raw POST body to avoid URLSearchParams auto-decoding
  // Based on memory: URLSearchParams auto-decodes values but PayFast signature uses encoded values
  const pairs = rawBody.split('&');
  const paramMap = new Map<string, string>();
  
  // Fields that MUST be excluded from PayFast ITN signature calculation
  // CRITICAL: Only exclude 'signature' field - PayFast includes token and billing_date!
  const EXCLUDED_ITN_FIELDS = new Set(['signature']);
  
  console.log('\nStep 1: Parsing parameters (preserving raw encoding)');
  for (const pair of pairs) {
    const equalIndex = pair.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = pair.substring(0, equalIndex);
    const value = pair.substring(equalIndex + 1); // Keep RAW encoded value
    paramMap.set(key, value);
    
    console.log(`  ${key} = "${value}" (raw) -> "${decodeURIComponent(value)}" (decoded)`);
  }
  
  const receivedSignature = paramMap.get('signature') || '';
  console.log('\nReceived signature:', receivedSignature);
  
  // CORRECT APPROACH: Use raw values in POST body order, exclude specific fields
  console.log('\nStep 2: Building signature string (CORRECT approach)');
  const signaturePairs: string[] = [];
  
  for (const pair of pairs) {
    const equalIndex = pair.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = pair.substring(0, equalIndex);
    const value = pair.substring(equalIndex + 1);
    
    // Skip excluded fields
    if (EXCLUDED_ITN_FIELDS.has(key)) {
      console.log(`  Excluding: ${key} (excluded field)`);
      continue;
    }
    
    // CRITICAL: PayFast includes empty fields in signature calculation!
    // Do NOT skip empty values - they are part of the signature
    
    // Use RAW value from POST body (already encoded by PayFast)
    signaturePairs.push(`${key}=${value}`);
    console.log(`  Including: ${key}=${value}`);
  }
  
  // Append passphrase (raw, not encoded)
  const signatureString = signaturePairs.join('&') + '&passphrase=' + passphrase;
  console.log('\nFinal signature string:', signatureString);
  
  const calculatedSignature = generateApiSignature(signatureString);
  console.log('Calculated signature:', calculatedSignature);
  console.log('Received signature:  ', receivedSignature);
  console.log('Signatures match:', calculatedSignature === receivedSignature ? '✅ YES' : '❌ NO');
  
  if (calculatedSignature === receivedSignature) {
    console.log('\n🎉 SIGNATURE VALIDATION SUCCESSFUL!');
    return new Response('OK', { status: 200 });
  }
  
  // If signature validation failed, log debug information
  console.log('\n❌ SIGNATURE VALIDATION FAILED - DEBUG INFO:');
  console.log('Environment passphrase length:', passphrase.length);
  console.log('Environment passphrase (first 10 chars):', passphrase.substring(0, 10));
  console.log('Merchant ID from env:', Deno.env.get('PAYFAST_SANDBOX_MERCHANT_ID') || 'NOT_SET');
  console.log('Merchant ID from ITN:', paramMap.get('merchant_id'));
  console.log('Raw body signature position:', rawBody.indexOf('signature='));
  
  // Test MD5 function with known values
  console.log('\n=== MD5 FUNCTION TEST ===');
  const testString = 'hello';
  const expectedMD5 = '5d41402abc4b2a76b9719d911017c592'; // Known MD5 of 'hello'
  const actualMD5 = generateApiSignature(testString);
  console.log(`Test string: '${testString}'`);
  console.log(`Expected MD5: ${expectedMD5}`);
  console.log(`Actual MD5: ${actualMD5}`);
  console.log(`MD5 function working: ${actualMD5 === expectedMD5 ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n=== END DEBUG ===\n');
}

// Validate PayFast ITN signature using raw POST body to preserve encoding
async function validatePayFastSignature(rawBody: string): Promise<boolean> {
  try {
    // Split the raw body to work with encoded values directly
    const pairs = rawBody.split('&');
    const paramMap = new Map<string, string>();
    
    // Parse into key-value pairs WITHOUT decoding
    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      paramMap.set(key, value);
    }
    
    const receivedSignature = paramMap.get('signature');
    if (!receivedSignature) {
      console.log('[ERROR] No signature provided in ITN data');
      return false;
    }

    const paramPairs: string[] = [];
    const excludedFields: string[] = [];
    
    // Build signature string using RAW encoded values in the order they appear
    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      
      // Exclude fields that PayFast doesn't include in ITN signature calculation
      if (EXCLUDED_ITN_FIELDS.has(key)) {
        excludedFields.push(`${key} (PayFast exclusion)`);
        continue;
      }
      
      // CRITICAL: PayFast includes empty fields in signature calculation!
      // Do NOT skip empty values - they are part of the signature
      
      // CRITICAL: Use the RAW encoded value from POST body
      // This preserves the exact encoding PayFast used for their signature
      paramPairs.push(`${key}=${value}`);
    }

    console.log('[DEBUG] Fields excluded from signature:', excludedFields);
    console.log('[DEBUG] Fields included in signature:', paramPairs.map(p => p.split('=')[0]));

    // Join the pairs and append the passphrase
    const paramString = paramPairs.join('&') + `&passphrase=${PAYFAST_PASSPHRASE}`;
    
    console.log('[DEBUG] Final string to hash:', paramString);
    
    const calculatedSignature = generateApiSignature(paramString);
    const isValid = calculatedSignature === receivedSignature;
    
    console.log(`[DEBUG] Signature validation: ${isValid ? 'VALID' : 'INVALID'}`);
    console.log(`[DEBUG] Received: ${receivedSignature}`);
    console.log(`[DEBUG] Calculated: ${calculatedSignature}`);
    
    return isValid;
  } catch (error) {
    console.error('[ERROR] Signature validation failed:', error);
    return false;
  }
}

// Server-to-server validation with PayFast
async function validateWithPayFast(itnData: Record<string, string>): Promise<boolean> {
  try {
    const validationUrl = 'https://sandbox.payfast.co.za/eng/query/validate';
    const formData = new URLSearchParams();
    
    // Add all ITN data to form
    for (const [key, value] of Object.entries(itnData)) {
      formData.append(key, value);
    }
    
    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    const result = await response.text();
    const isValid = result.trim() === 'VALID';
    
    console.log(`[DEBUG] PayFast server validation: ${isValid ? 'VALID' : 'INVALID'}`);
    console.log(`[DEBUG] PayFast response: ${result}`);
    
    return isValid;
  } catch (error) {
    console.error('[ERROR] PayFast server validation failed:', error);
    return false; // Don't block processing if server validation fails
  }
}

// Calculate next billing date (30 days from now)
function calculateNextBillingDate(): string {
  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + 30);
  return nextBilling.toISOString();
}

// Main handler
Deno.serve(async (req) => {
  console.log('=== PayFast ITN Received ===');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Extract client IP for security checks
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // � SECURITY: IP Allowlist Check
  // Only accept requests from PayFast's known IP ranges
  if (!isPayFastIP(clientIP)) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      event: 'ITN_IP_BLOCKED',
      ip: clientIP,
      userAgent,
      status: 'blocked',
      details: { reason: 'IP not in PayFast allowlist' }
    });
    
    return new Response('Forbidden', {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }

  // � SECURITY: Apply rate limiting for webhook endpoint
  // Allow legitimate PayFast traffic but prevent abuse
  const rateLimitResponse = await applyRateLimit(
    req,
    RATE_LIMIT_CONFIGS.WEBHOOK,
    'payfast-itn',
    supabaseUrl,
    supabaseServiceKey
  );
  
  if (rateLimitResponse) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      event: 'ITN_RATE_LIMITED',
      ip: clientIP,
      userAgent,
      status: 'blocked',
      details: { reason: 'Rate limit exceeded' }
    });
    return rateLimitResponse;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
  
  try {
    // Parse ITN data from the raw POST body
    const body = await req.text();
    console.log('[DEBUG] Raw ITN body:', body);
    
    // Use URLSearchParams to preserve parameter order, which is critical for signature validation.
    const itnParams = new URLSearchParams(body);
    
    // Create a plain object for easier data access in the business logic.
    const itnData: Record<string, string> = Object.fromEntries(itnParams);
    
    console.log('[DEBUG] Parsed ITN data:', JSON.stringify(itnData, null, 2));
    
    // Extract key fields
    const paymentStatus = itnData.payment_status;
    const userId = itnData.custom_str1;
    const paymentId = itnData.m_payment_id;
    const amount = parseFloat(itnData.amount_gross || '0');
    
    console.log(`[INFO] Processing ITN - Status: ${paymentStatus}, User: ${userId}, Payment: ${paymentId}, Amount: ${amount}`);
    
    // Validate required fields
    if (!paymentStatus || !userId || !paymentId) {
      console.error('[ERROR] Missing required ITN fields');
      return new Response('Bad Request - Missing required fields', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Check if we've already processed this payment
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    console.log('[DEBUG] Existing profile:', existingProfile);
    console.log('[DEBUG] Profile error:', profileError);
    
    // Check if this specific payment was already successfully processed
    // We use pf_payment_id (PayFast's payment ID) as the unique identifier for processed payments
    if (existingProfile && existingProfile.pf_payment_id === itnData.pf_payment_id) {
      console.log('[INFO] Payment already processed (pf_payment_id:', itnData.pf_payment_id, '), skipping');
      return new Response('OK - Already processed', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    if (!existingProfile) {
      console.log('[INFO] No existing profile found, will create/update profile');
    }
    
    // Run comprehensive debug first
    console.log('[DEBUG] Running comprehensive signature debug...');
    console.log('[DEBUG] Environment check - Passphrase length:', PAYFAST_PASSPHRASE.length);
    console.log('[DEBUG] Environment check - Merchant ID:', Deno.env.get('PAYFAST_SANDBOX_MERCHANT_ID') || 'NOT_SET');
    debugPayFastSignature(body, PAYFAST_PASSPHRASE);
    
    // Validate signature using the raw body to preserve exact encoding
    const signatureValid = await validatePayFastSignature(body);
    if (!signatureValid) {
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        event: 'ITN_SIGNATURE_INVALID',
        ip: clientIP,
        userAgent,
        paymentId,
        userId,
        status: 'failure',
        details: { reason: 'Signature validation failed' }
      });
      return new Response('Unauthorized - Invalid signature', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Server-to-server validation (optional, don't block if it fails)
    await validateWithPayFast(itnData);
    
    // Process successful payment
    if (paymentStatus === 'COMPLETE') {
      console.log('[INFO] Processing successful payment');
      
      const nextBillingDate = calculateNextBillingDate();
      
      // Update user profile with all Captain's Club benefits
      const now = new Date();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          plan: 'captains_club',
          plan_status: 'active',
          next_billing_date: nextBillingDate,
          plan_period_end: nextBillingDate, // Same as next billing date for monthly billing
          plan_activated_at: now.toISOString(),
          payfast_token: itnData.token || null, // PayFast token for recurring billing
          can_access_past_exams: true, // Captain's Club can access past exams
          monthly_quizzes_remaining: -1, // -1 means unlimited for Captain's Club
          last_quota_reset_date: now.toISOString().split('T')[0], // Current date in YYYY-MM-DD format
          pf_payment_id: itnData.pf_payment_id, // PayFast's unique payment ID for duplicate detection
          m_payment_id_last_attempt: paymentId, // Our merchant payment ID for tracking
          updated_at: now.toISOString()
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('[ERROR] Failed to update user profile:', updateError);
        return new Response('Internal Server Error - Database update failed', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        event: 'ITN_PAYMENT_SUCCESS',
        ip: clientIP,
        userAgent,
        paymentId,
        userId,
        status: 'success',
        details: { 
          amount,
          nextBillingDate,
          pfPaymentId: itnData.pf_payment_id
        }
      });
      console.log(`[SUCCESS] User ${userId} upgraded to Captain's Club subscription`);
      console.log(`[INFO] Next billing date: ${nextBillingDate}`);
    } else {
      console.log(`[INFO] Payment not complete, status: ${paymentStatus}`);
      
      // Still update the payment ID to prevent reprocessing
      await supabase
        .from('profiles')
        .update({
          m_payment_id_last_attempt: paymentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }
    
    return new Response('OK', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
    
  } catch (error) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      event: 'ITN_PROCESSING_ERROR',
      ip: clientIP,
      userAgent,
      status: 'failure',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    console.error('[ERROR] ITN processing failed:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
