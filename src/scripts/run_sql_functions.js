import { supabase } from '../services/supabaseClient';
import { logger } from '../services/loggerService';

/**
 * Executes SQL functions to set up stored procedures in Supabase
 */
const runSqlFunctions = async () => {
  try {
    logger.info('Starting SQL function setup');
    
    // Function to update document size
    const updateSizeFunction = `
      CREATE OR REPLACE FUNCTION update_document_size(document_id UUID, size_in_bytes BIGINT)
      RETURNS VOID AS $$
      BEGIN
        UPDATE documents
        SET file_size = size_in_bytes
        WHERE id = document_id;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Function to calculate total storage usage for a user
    const storageSumFunction = `
      CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id_param UUID)
      RETURNS BIGINT AS $$
      DECLARE
        total_size BIGINT;
      BEGIN
        SELECT COALESCE(SUM(file_size), 0)
        INTO total_size
        FROM documents
        WHERE user_id = user_id_param;
        
        RETURN total_size;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Execute the SQL functions
    const { error: updateFunctionError } = await supabase.rpc('exec_sql', { sql: updateSizeFunction });
    if (updateFunctionError) {
      logger.error('Error creating update_document_size function:', updateFunctionError);
    } else {
      logger.info('Successfully created update_document_size function');
    }
    
    const { error: sumFunctionError } = await supabase.rpc('exec_sql', { sql: storageSumFunction });
    if (sumFunctionError) {
      logger.error('Error creating get_user_storage_usage function:', sumFunctionError);
    } else {
      logger.info('Successfully created get_user_storage_usage function');
    }
    
    logger.info('SQL function setup completed');
  } catch (error) {
    logger.error('Error setting up SQL functions:', error);
  }
};

// Run the script
runSqlFunctions()
  .then(() => {
    logger.info('SQL function setup script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('SQL function setup script failed:', error);
    process.exit(1);
  });
