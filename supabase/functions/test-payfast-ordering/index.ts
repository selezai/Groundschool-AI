import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Complete MD5 implementation (same as before)
function md5(input: string): string {
  // Convert string to array of little-endian words
  function stringToWords(str: string): number[] {
    const words: number[] = [];
    for (let i = 0; i < str.length * 8; i += 8) {
      words[i >> 5] |= (str.charCodeAt(i / 8) & 0xFF) << (i % 32);
    }
    return words;
  }

  // Convert array of little-endian words to hex string
  function wordsToHex(words: number[]): string {
    const hexChars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < words.length * 32; i += 8) {
      result += hexChars.charAt((words[i >> 5] >>> (i % 32 + 4)) & 0xF) +
                hexChars.charAt((words[i >> 5] >>> (i % 32)) & 0xF);
    }
    return result;
  }

  // Safe 32-bit addition
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  // Bitwise rotate left
  function rotateLeft(value: number, amount: number): number {
    return (value << amount) | (value >>> (32 - amount));
  }

  // MD5 auxiliary functions
  function md5F(x: number, y: number, z: number): number {
    return (x & y) | ((~x) & z);
  }

  function md5G(x: number, y: number, z: number): number {
    return (x & z) | (y & (~z));
  }

  function md5H(x: number, y: number, z: number): number {
    return x ^ y ^ z;
  }

  function md5I(x: number, y: number, z: number): number {
    return y ^ (x | (~z));
  }

  // Core MD5 transformation
  function md5Transform(a: number, b: number, c: number, d: number, x: number, s: number, t: number, func: (x: number, y: number, z: number) => number): number {
    return safeAdd(rotateLeft(safeAdd(safeAdd(a, func(b, c, d)), safeAdd(x, t)), s), b);
  }

  // Convert input to words and add padding
  const words = stringToWords(input);
  const bitLength = input.length * 8;
  
  // Append '1' bit
  words[bitLength >> 5] |= 0x80 << (bitLength % 32);
  
  // Append length in bits as 64-bit little-endian
  const lengthIndex = (((bitLength + 64) >>> 9) << 4) + 14;
  words[lengthIndex] = bitLength;
  words[lengthIndex + 1] = 0;

  // Initialize MD5 buffer
  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;

  // Process message in 512-bit chunks
  for (let i = 0; i < words.length; i += 16) {
    let a = h0, b = h1, c = h2, d = h3;

    // Round 1
    a = md5Transform(a, b, c, d, words[i + 0], 7, 0xD76AA478, md5F);
    d = md5Transform(d, a, b, c, words[i + 1], 12, 0xE8C7B756, md5F);
    c = md5Transform(c, d, a, b, words[i + 2], 17, 0x242070DB, md5F);
    b = md5Transform(b, c, d, a, words[i + 3], 22, 0xC1BDCEEE, md5F);
    a = md5Transform(a, b, c, d, words[i + 4], 7, 0xF57C0FAF, md5F);
    d = md5Transform(d, a, b, c, words[i + 5], 12, 0x4787C62A, md5F);
    c = md5Transform(c, d, a, b, words[i + 6], 17, 0xA8304613, md5F);
    b = md5Transform(b, c, d, a, words[i + 7], 22, 0xFD469501, md5F);
    a = md5Transform(a, b, c, d, words[i + 8], 7, 0x698098D8, md5F);
    d = md5Transform(d, a, b, c, words[i + 9], 12, 0x8B44F7AF, md5F);
    c = md5Transform(c, d, a, b, words[i + 10], 17, 0xFFFF5BB1, md5F);
    b = md5Transform(b, c, d, a, words[i + 11], 22, 0x895CD7BE, md5F);
    a = md5Transform(a, b, c, d, words[i + 12], 7, 0x6B901122, md5F);
    d = md5Transform(d, a, b, c, words[i + 13], 12, 0xFD987193, md5F);
    c = md5Transform(c, d, a, b, words[i + 14], 17, 0xA679438E, md5F);
    b = md5Transform(b, c, d, a, words[i + 15], 22, 0x49B40821, md5F);

    // Round 2
    a = md5Transform(a, b, c, d, words[i + 1], 5, 0xF61E2562, md5G);
    d = md5Transform(d, a, b, c, words[i + 6], 9, 0xC040B340, md5G);
    c = md5Transform(c, d, a, b, words[i + 11], 14, 0x265E5A51, md5G);
    b = md5Transform(b, c, d, a, words[i + 0], 20, 0xE9B6C7AA, md5G);
    a = md5Transform(a, b, c, d, words[i + 5], 5, 0xD62F105D, md5G);
    d = md5Transform(d, a, b, c, words[i + 10], 9, 0x02441453, md5G);
    c = md5Transform(c, d, a, b, words[i + 15], 14, 0xD8A1E681, md5G);
    b = md5Transform(b, c, d, a, words[i + 4], 20, 0xE7D3FBC8, md5G);
    a = md5Transform(a, b, c, d, words[i + 9], 5, 0x21E1CDE6, md5G);
    d = md5Transform(d, a, b, c, words[i + 14], 9, 0xC33707D6, md5G);
    c = md5Transform(c, d, a, b, words[i + 3], 14, 0xF4D50D87, md5G);
    b = md5Transform(b, c, d, a, words[i + 8], 20, 0x455A14ED, md5G);
    a = md5Transform(a, b, c, d, words[i + 13], 5, 0xA9E3E905, md5G);
    d = md5Transform(d, a, b, c, words[i + 2], 9, 0xFCEFA3F8, md5G);
    c = md5Transform(c, d, a, b, words[i + 7], 14, 0x676F02D9, md5G);
    b = md5Transform(b, c, d, a, words[i + 12], 20, 0x8D2A4C8A, md5G);

    // Round 3
    a = md5Transform(a, b, c, d, words[i + 5], 4, 0xFFFA3942, md5H);
    d = md5Transform(d, a, b, c, words[i + 8], 11, 0x8771F681, md5H);
    c = md5Transform(c, d, a, b, words[i + 11], 16, 0x6D9D6122, md5H);
    b = md5Transform(b, c, d, a, words[i + 14], 23, 0xFDE5380C, md5H);
    a = md5Transform(a, b, c, d, words[i + 1], 4, 0xA4BEEA44, md5H);
    d = md5Transform(d, a, b, c, words[i + 4], 11, 0x4BDECFA9, md5H);
    c = md5Transform(c, d, a, b, words[i + 7], 16, 0xF6BB4B60, md5H);
    b = md5Transform(b, c, d, a, words[i + 10], 23, 0xBEBFBC70, md5H);
    a = md5Transform(a, b, c, d, words[i + 13], 4, 0x289B7EC6, md5H);
    d = md5Transform(d, a, b, c, words[i + 0], 11, 0xEAA127FA, md5H);
    c = md5Transform(c, d, a, b, words[i + 3], 16, 0xD4EF3085, md5H);
    b = md5Transform(b, c, d, a, words[i + 6], 23, 0x04881D05, md5H);
    a = md5Transform(a, b, c, d, words[i + 9], 4, 0xD9D4D039, md5H);
    d = md5Transform(d, a, b, c, words[i + 12], 11, 0xE6DB99E5, md5H);
    c = md5Transform(c, d, a, b, words[i + 15], 16, 0x1FA27CF8, md5H);
    b = md5Transform(b, c, d, a, words[i + 2], 23, 0xC4AC5665, md5H);

    // Round 4
    a = md5Transform(a, b, c, d, words[i + 0], 6, 0xF4292244, md5I);
    d = md5Transform(d, a, b, c, words[i + 7], 10, 0x432AFF97, md5I);
    c = md5Transform(c, d, a, b, words[i + 14], 15, 0xAB9423A7, md5I);
    b = md5Transform(b, c, d, a, words[i + 5], 21, 0xFC93A039, md5I);
    a = md5Transform(a, b, c, d, words[i + 12], 6, 0x655B59C3, md5I);
    d = md5Transform(d, a, b, c, words[i + 3], 10, 0x8F0CCC92, md5I);
    c = md5Transform(c, d, a, b, words[i + 10], 15, 0xFFEFF47D, md5I);
    b = md5Transform(b, c, d, a, words[i + 1], 21, 0x85845DD1, md5I);
    a = md5Transform(a, b, c, d, words[i + 8], 6, 0x6FA87E4F, md5I);
    d = md5Transform(d, a, b, c, words[i + 15], 10, 0xFE2CE6E0, md5I);
    c = md5Transform(c, d, a, b, words[i + 6], 15, 0xA3014314, md5I);
    b = md5Transform(b, c, d, a, words[i + 13], 21, 0x4E0811A1, md5I);
    a = md5Transform(a, b, c, d, words[i + 4], 6, 0xF7537E82, md5I);
    d = md5Transform(d, a, b, c, words[i + 11], 10, 0xBD3AF235, md5I);
    c = md5Transform(c, d, a, b, words[i + 2], 15, 0x2AD7D2BB, md5I);
    b = md5Transform(b, c, d, a, words[i + 9], 21, 0xEB86D391, md5I);

    // Add this chunk's hash to result so far
    h0 = safeAdd(h0, a);
    h1 = safeAdd(h1, b);
    h2 = safeAdd(h2, c);
    h3 = safeAdd(h3, d);
  }

  return wordsToHex([h0, h1, h2, h3]);
}

serve(async (req) => {
  try {
    console.log('=== PAYFAST PARAMETER ORDERING TEST ===');
    
    // Your real PayFast ITN data
    const rawBody = 'm_payment_id=c9f3dea7-cb8e-4f3a-9200-f6ed2fc0d7a0&pf_payment_id=2591915&payment_status=COMPLETE&item_name=Captain%27s+Club+Subscription&item_description=First+payment+for+Captain%27s+Club+Subscription&amount_gross=99.00&amount_fee=-2.30&amount_net=96.70&custom_str1=f50ff0ee-0a56-4c24-bd2f-d46761644db3&custom_str2=&custom_str3=&custom_str4=&custom_str5=&custom_int1=&custom_int2=&custom_int3=&custom_int4=&custom_int5=&name_first=lk&name_last=&email_address=s%40s.com&merchant_id=10039481&token=efff70cc-f23c-42c6-be63-80a3a4b9a12c&billing_date=2025-06-28';
    const passphrase = 'sandboxAlphaBravo2024';
    const expectedSignature = '2927f356e49313647c4b8aefbd2990eb'; // From PayFast
    
    const EXCLUDED_ITN_FIELDS = new Set(['signature', 'token', 'billing_date']);
    
    // Parse parameters
    const pairs = rawBody.split('&');
    const params: Array<{key: string, value: string, rawPair: string}> = [];
    
    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = pair.substring(0, equalIndex);
      const value = pair.substring(equalIndex + 1);
      
      // Skip excluded fields and empty values
      if (EXCLUDED_ITN_FIELDS.has(key)) continue;
      if (value === '' || decodeURIComponent(value).trim() === '') continue;
      
      params.push({ key, value, rawPair: `${key}=${value}` });
    }
    
    console.log('Parsed parameters:', params.map(p => p.rawPair));
    
    // Test different ordering approaches
    const orderingTests = [
      {
        name: 'POST Body Order (Current Implementation)',
        params: params,
        description: 'Parameters in the order they appear in POST body'
      },
      {
        name: 'Alphabetical Order by Key',
        params: [...params].sort((a, b) => a.key.localeCompare(b.key)),
        description: 'Parameters sorted alphabetically by key name'
      },
      {
        name: 'Reverse Alphabetical Order',
        params: [...params].sort((a, b) => b.key.localeCompare(a.key)),
        description: 'Parameters sorted reverse alphabetically'
      },
      {
        name: 'PayFast Standard Order',
        params: [...params].sort((a, b) => {
          // PayFast documentation suggests this order
          const payFastOrder = [
            'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
            'm_payment_id', 'amount', 'amount_gross', 'amount_fee', 'amount_net',
            'pf_payment_id', 'payment_status', 'item_name', 'item_description',
            'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
            'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
            'name_first', 'name_last', 'email_address'
          ];
          
          const aIndex = payFastOrder.indexOf(a.key);
          const bIndex = payFastOrder.indexOf(b.key);
          
          if (aIndex === -1 && bIndex === -1) return a.key.localeCompare(b.key);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }),
        description: 'Parameters in PayFast documentation order'
      }
    ];
    
    const results = [];
    
    for (const test of orderingTests) {
      console.log(`\n=== ${test.name} ===`);
      
      const signatureString = test.params.map(p => p.rawPair).join('&') + '&passphrase=' + passphrase;
      const calculatedSignature = md5(signatureString);
      const isMatch = calculatedSignature === expectedSignature;
      
      console.log(`Signature string: ${signatureString}`);
      console.log(`Calculated: ${calculatedSignature}`);
      console.log(`Expected: ${expectedSignature}`);
      console.log(`Match: ${isMatch ? '✅ YES' : '❌ NO'}`);
      
      results.push({
        name: test.name,
        description: test.description,
        signatureString: signatureString,
        calculatedSignature: calculatedSignature,
        expectedSignature: expectedSignature,
        isMatch: isMatch,
        parameterOrder: test.params.map(p => p.key)
      });
    }
    
    // Additional test: Try with URL-decoded values
    console.log('\n=== URL DECODING TEST ===');
    const decodedParams = params.map(p => ({
      key: p.key,
      value: decodeURIComponent(p.value),
      rawPair: `${p.key}=${decodeURIComponent(p.value)}`
    }));
    
    const decodedSignatureString = decodedParams.map(p => p.rawPair).join('&') + '&passphrase=' + passphrase;
    const decodedSignature = md5(decodedSignatureString);
    const decodedMatch = decodedSignature === expectedSignature;
    
    console.log(`Decoded signature string: ${decodedSignatureString}`);
    console.log(`Decoded calculated: ${decodedSignature}`);
    console.log(`Decoded match: ${decodedMatch ? '✅ YES' : '❌ NO'}`);
    
    results.push({
      name: 'URL Decoded Values',
      description: 'Using URL-decoded parameter values instead of raw encoded',
      signatureString: decodedSignatureString,
      calculatedSignature: decodedSignature,
      expectedSignature: expectedSignature,
      isMatch: decodedMatch,
      parameterOrder: decodedParams.map(p => p.key)
    });
    
    return new Response(JSON.stringify({
      message: 'PayFast parameter ordering test completed',
      expectedSignature: expectedSignature,
      testResults: results,
      summary: {
        totalTests: results.length,
        matchingTests: results.filter(r => r.isMatch).length,
        winner: results.find(r => r.isMatch)?.name || 'No match found'
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('Error in PayFast ordering test:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
