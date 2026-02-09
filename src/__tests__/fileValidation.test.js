/**
 * File Validation Tests
 * Tests for file type validation and sanitization
 */

import fileValidation from '../utils/fileValidation';

const { sanitizeFilename, ALLOWED_FILE_TYPES } = fileValidation;

describe('File Validation', () => {
  describe('ALLOWED_FILE_TYPES', () => {
    it('should include PDF files', () => {
      expect(ALLOWED_FILE_TYPES['application/pdf']).toBeDefined();
    });

    it('should include Word documents', () => {
      expect(ALLOWED_FILE_TYPES['application/msword']).toBeDefined();
      expect(ALLOWED_FILE_TYPES['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBeDefined();
    });

    it('should include text files', () => {
      expect(ALLOWED_FILE_TYPES['text/plain']).toBeDefined();
    });

    it('should not include executable files', () => {
      expect(ALLOWED_FILE_TYPES['application/x-executable']).toBeUndefined();
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      const result = sanitizeFilename('../../../etc/passwd');
      expect(result).not.toContain('/');
    });

    it('should remove dangerous characters', () => {
      const result = sanitizeFilename('file<script>alert("xss")</script>.pdf');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should preserve valid filenames', () => {
      const result = sanitizeFilename('my-document_v2.pdf');
      expect(result).toBe('my-document_v2.pdf');
    });

    it('should handle empty filename', () => {
      const result = sanitizeFilename('');
      expect(result).toBe('document');
    });

    it('should handle filename with only special characters', () => {
      const result = sanitizeFilename('***???');
      // Special chars are replaced with underscores, not removed entirely
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });
});
