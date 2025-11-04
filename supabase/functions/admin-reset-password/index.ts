import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
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

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the requesting user is an admin
    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      throw new Error('Invalid token')
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('hr_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userData || userData.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    // Get the request body
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      throw new Error('Missing userId or newPassword')
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Get the user's auth ID from user_emails table
    const { data: emailData, error: emailError } = await supabaseAdmin
      .from('user_emails')
      .select('auth_user_id')
      .eq('user_id', userId)
      .single()

    let authUserId = emailData?.auth_user_id

    // If not found in user_emails, use the userId directly (it might be the auth ID)
    if (!authUserId) {
      authUserId = userId
    }

    // Update the user's password using admin API
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
      { password: newPassword }
    )

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        user: updateData.user 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
