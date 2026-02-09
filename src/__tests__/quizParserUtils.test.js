/**
 * Quiz Parser Utilities Tests
 * Tests for JSON parsing and correction functionality
 */

// Mock logger
jest.mock('../services/loggerService', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import { QuizJSONParser } from '../utils/quizParserUtils';

describe('QuizJSONParser', () => {
  let parser;

  beforeEach(() => {
    parser = new QuizJSONParser({ enableLogging: false });
  });

  describe('parseQuizJSON', () => {
    it('should throw for invalid input', () => {
      expect(() => parser.parseQuizJSON('not json at all')).toThrow();
    });
  });

  describe('fixTrailingCommas', () => {
    it('should fix trailing commas', () => {
      const jsonWithTrailingComma = '{"title": "Test",}';

      const fixed = parser.fixTrailingCommas(jsonWithTrailingComma);

      expect(fixed).toBe('{"title": "Test"}');
    });

    it('should fix extra commas before closing brackets', () => {
      const jsonWithExtraCommas = '{"items": [1, 2, 3,]}';

      const fixed = parser.fixTrailingCommas(jsonWithExtraCommas);

      expect(fixed).toBe('{"items": [1, 2, 3]}');
    });
  });
});
