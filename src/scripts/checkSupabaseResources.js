import { runSupabaseSetupCheck } from '../utils/checkSupabaseSetup';

// Run the check and display results
console.log('Starting Supabase resource check...');
runSupabaseSetupCheck()
  .then(results => {
    console.log('Check completed.');
    if (results.error) {
      console.error('Error during check:', results.error);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to run check:', error);
    process.exit(1);
  });
