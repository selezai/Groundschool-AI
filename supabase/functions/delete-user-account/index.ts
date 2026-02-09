import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// SECURITY: Structured Request Logging
// ============================================================================
interface SecurityLog {
  timestamp: string;
  event: string;
  ip: string;
  userAgent: string;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Extract client info for security logging
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        },
        auth: {
          persistSession: false
        }
      }
    )

    // Get the session or user object
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Delete account request for user:', user.id)

    // Create admin client for user deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Step 1: Delete user's documents from storage
    console.log('Deleting user documents from storage...')
    const { data: documents, error: documentsError } = await supabaseClient
      .from('documents')
      .select('file_path')
      .eq('user_id', user.id)

    if (!documentsError && documents && documents.length > 0) {
      const filePaths = documents.map(doc => doc.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        const { error: storageError } = await supabaseClient.storage
          .from('documents')
          .remove(filePaths)
        
        if (storageError) {
          console.error('Error deleting documents from storage:', storageError)
        } else {
          console.log(`Deleted ${filePaths.length} documents from storage`)
        }
      }
    }

    // Step 2: Delete user's profile and related data (CASCADE should handle related records)
    console.log('Deleting user profile and related data...')
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user data', details: profileError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 3: Delete the auth user using admin client
    console.log('Deleting auth user...')
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account', details: authError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    logSecurityEvent({
      timestamp: new Date().toISOString(),
      event: 'ACCOUNT_DELETED',
      ip: clientIP,
      userAgent,
      userId: user.id,
      status: 'success',
      details: { message: 'User account and all data deleted' }
    });
    console.log('Account deleted successfully for user:', user.id)

    return new Response(
      JSON.stringify({ message: 'Account deleted successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    logSecurityEvent({
      timestamp: new Date().toISOString(),
      event: 'ACCOUNT_DELETION_ERROR',
      ip: clientIP,
      userAgent,
      status: 'failure',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    console.error('Exception in delete-user-account function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
