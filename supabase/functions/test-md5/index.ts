import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Complete MD5 implementation for Deno environment
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
    console.log('=== MD5 TEST FUNCTION ===');
    
    // Test known MD5 values
    const tests = [
      { input: 'hello', expected: '5d41402abc4b2a76b9719d911017c592' },
      { input: '', expected: 'd41d8cd98f00b204e9800998ecf8427e' },
      { input: 'a', expected: '0cc175b9c0f1b6a831c399e269772661' },
      { input: 'abc', expected: '900150983cd24fb0d6963f7d28e17f72' }
    ];
    
    const results = [];
    
    for (const test of tests) {
      const actual = md5(test.input);
      const passed = actual === test.expected;
      
      console.log(`Input: "${test.input}"`);
      console.log(`Expected: ${test.expected}`);
      console.log(`Actual:   ${actual}`);
      console.log(`Passed: ${passed ? '✅' : '❌'}`);
      console.log('---');
      
      results.push({
        input: test.input,
        expected: test.expected,
        actual: actual,
        passed: passed
      });
    }
    
    const allPassed = results.every(r => r.passed);
    
    return new Response(JSON.stringify({
      message: allPassed ? 'All MD5 tests passed!' : 'Some MD5 tests failed!',
      results: results,
      overall: allPassed ? 'PASS' : 'FAIL'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('Error in MD5 test:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
