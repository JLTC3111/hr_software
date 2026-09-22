import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getActiveHrAdmin, getHrAuthUserIds } from '../_shared/hrAuth.js'

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
    if (!authHeader?.startsWith('Bearer ')) {
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
    const userData = await getActiveHrAdmin(supabaseAdmin, user.id)
    if (!userData) {
      throw new Error('Unauthorized: Admin access required')
    }

    // Get the request body
    const { userId, newPassword } = await req.json()

    if (typeof userId !== 'string' || !userId || typeof newPassword !== 'string' || !newPassword) {
      throw new Error('Missing userId or newPassword')
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('hr_users').select('id').eq('id', userId).maybeSingle()
    if (targetError) throw targetError
    if (!target) throw new Error('HR user not found')

    // A profile can have several login emails, each backed by an Auth account.
    const authUserIds = await getHrAuthUserIds(supabaseAdmin, userId)
    for (const authUserId of authUserIds) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: newPassword }
      )
      if (updateError) throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully'
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
        error: error instanceof Error ? error.message : 'Failed to reset password'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
