/**
 * Enhanced File Validation Utilities
 * Provides comprehensive security validation for file uploads
 */

import logger from '../services/loggerService';

// Allowed MIME types with their corresponding file signatures (magic numbers)
const ALLOWED_FILE_TYPES = {
  // PDF files
  'application/pdf': {
    signatures: [
      [0x25, 0x50, 0x44, 0x46], // %PDF
    ],
    extensions: ['.pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  
  // Text files
  'text/plain': {
    signatures: [], // Text files don't have reliable magic numbers
    extensions: ['.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  
  // Word documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    signatures: [
      [0x50, 0x4B, 0x03, 0x04], // ZIP signature (DOCX is ZIP-based)
    ],
    extensions: ['.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  
  'application/msword': {
    signatures: [
      [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // OLE signature
    ],
    extensions: ['.doc'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  
  // Image files
  'image/jpeg': {
    signatures: [
      [0xFF, 0xD8, 0xFF], // JPEG
    ],
    extensions: ['.jpg', '.jpeg'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  
  'image/png': {
    signatures: [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ],
    extensions: ['.png'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  
  'image/heic': {
    signatures: [
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // HEIC
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // HEIC variant
    ],
    extensions: ['.heic'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
};

// Dangerous file extensions that should never be allowed
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.dll', '.so', '.dylib',
  '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.ps1',
];

/**
 * Validates file extension against allowed types
 * @param {string} filename - The filename to validate
 * @param {string} mimeType - The declared MIME type
 * @returns {boolean} - True if extension is valid
 */
const validateFileExtension = (filename, mimeType) => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  // Check for dangerous extensions
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    logger.error('fileValidation:validateFileExtension', 'Dangerous file extension detected', { 
      filename, 
      extension, 
      mimeType 
    });
    return false;
  }
  
  // Check if extension matches declared MIME type
  const allowedType = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedType) {
    logger.error('fileValidation:validateFileExtension', 'MIME type not allowed', { 
      filename, 
      mimeType 
    });
    return false;
  }
  
  if (!allowedType.extensions.includes(extension)) {
    logger.error('fileValidation:validateFileExtension', 'Extension does not match MIME type', { 
      filename, 
      extension, 
      mimeType, 
      allowedExtensions: allowedType.extensions 
    });
    return false;
  }
  
  return true;
};

/**
 * Validates file signature (magic numbers) against declared MIME type
 * @param {ArrayBuffer} fileBuffer - First few bytes of the file
 * @param {string} mimeType - The declared MIME type
 * @returns {boolean} - True if signature matches
 */
const validateFileSignature = (fileBuffer, mimeType) => {
  const allowedType = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedType || !allowedType.signatures.length) {
    // Some file types (like text) don't have reliable signatures
    return mimeType === 'text/plain';
  }
  
  const bytes = new Uint8Array(fileBuffer);
  
  // Check if any of the allowed signatures match
  for (const signature of allowedType.signatures) {
    if (signature.length <= bytes.length) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (bytes[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
  }
  
  logger.error('fileValidation:validateFileSignature', 'File signature does not match MIME type', { 
    mimeType, 
    actualBytes: Array.from(bytes.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ') 
  });
  return false;
};

/**
 * Validates file size against type-specific limits
 * @param {number} fileSize - Size of the file in bytes
 * @param {string} mimeType - The declared MIME type
 * @returns {boolean} - True if size is within limits
 */
const validateFileSize = (fileSize, mimeType) => {
  const allowedType = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedType) {
    return false;
  }
  
  if (fileSize > allowedType.maxSize) {
    logger.error('fileValidation:validateFileSize', 'File size exceeds limit for type', { 
      fileSize, 
      mimeType, 
      maxSize: allowedType.maxSize,
      fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: (allowedType.maxSize / (1024 * 1024)).toFixed(2)
    });
    return false;
  }
  
  return true;
};

/**
 * Sanitizes filename to prevent path traversal and other attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove path separators and dangerous characters
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
  
  // Ensure filename is not empty after sanitization
  if (!sanitized) {
    sanitized = 'document';
  }
  
  // Limit filename length
  if (sanitized.length > 100) {
    const extension = sanitized.substring(sanitized.lastIndexOf('.'));
    const baseName = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = baseName.substring(0, 100 - extension.length) + extension;
  }
  
  return sanitized;
};

/**
 * Comprehensive file validation
 * @param {object} fileAsset - File asset from document picker
 * @returns {Promise<object>} - Validation result with success/error info
 */
export const validateFile = async (fileAsset) => {
  try {
    const { name, mimeType, size, uri } = fileAsset;
    
    logger.info('fileValidation:validateFile', 'Starting file validation', { 
      name, 
      mimeType, 
      size 
    });
    
    // 1. Validate basic file properties
    if (!name || !mimeType || !size || !uri) {
      return {
        isValid: false,
        error: 'Invalid file: Missing required properties',
        details: { name: !!name, mimeType: !!mimeType, size: !!size, uri: !!uri }
      };
    }
    
    // 2. Validate file extension
    if (!validateFileExtension(name, mimeType)) {
      return {
        isValid: false,
        error: 'Invalid file type or extension',
        details: { filename: name, mimeType }
      };
    }
    
    // 3. Validate file size
    if (!validateFileSize(size, mimeType)) {
      const allowedType = ALLOWED_FILE_TYPES[mimeType];
      return {
        isValid: false,
        error: `File size exceeds limit for ${mimeType}`,
        details: { 
          fileSize: size, 
          maxSize: allowedType?.maxSize,
          fileSizeMB: (size / (1024 * 1024)).toFixed(2),
          maxSizeMB: allowedType ? (allowedType.maxSize / (1024 * 1024)).toFixed(2) : 'unknown'
        }
      };
    }
    
    // 4. Read file header for signature validation (first 32 bytes should be enough)
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const headerBuffer = arrayBuffer.slice(0, 32);
      
      if (!validateFileSignature(headerBuffer, mimeType)) {
        return {
          isValid: false,
          error: 'File signature does not match declared type',
          details: { mimeType, filename: name }
        };
      }
    } catch (signatureError) {
      logger.warn('fileValidation:validateFile', 'Could not validate file signature', { 
        error: signatureError.message,
        filename: name 
      });
      // Continue without signature validation if file reading fails
    }
    
    // 5. Sanitize filename
    const sanitizedName = sanitizeFilename(name);
    
    logger.info('fileValidation:validateFile', 'File validation successful', { 
      originalName: name,
      sanitizedName,
      mimeType,
      size 
    });
    
    return {
      isValid: true,
      sanitizedFilename: sanitizedName,
      details: { mimeType, size }
    };
    
  } catch (error) {
    logger.error('fileValidation:validateFile', 'File validation failed with exception', { 
      error: error.message,
      filename: fileAsset?.name 
    });
    
    return {
      isValid: false,
      error: 'File validation failed',
      details: { exception: error.message }
    };
  }
};

export default {
  validateFile,
  sanitizeFilename,
  ALLOWED_FILE_TYPES,
  DANGEROUS_EXTENSIONS
};
