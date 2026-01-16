import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS })
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user from Supabase session
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json(
        { authenticated: false },
        { headers: CORS_HEADERS }
      )
    }
    
    // Get user metadata
    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      plan: user.user_metadata?.plan || 'Hobby',
    }
    
    // Get session token
    const { data: { session } } = await supabase.auth.getSession()
    
    return NextResponse.json(
      {
        authenticated: true,
        token: session?.access_token || '',
        user: userInfo,
      },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error("[Auth Status] Error:", error)
    return NextResponse.json(
      { authenticated: false, error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

