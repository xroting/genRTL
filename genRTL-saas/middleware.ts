import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // CORS headers for all API routes
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // 允许所有来源（开发环境）
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders })
  }

  // For all other requests, add CORS headers to the response
  const response = NextResponse.next()
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

// 只对 API 路由应用中间件
export const config = {
  matcher: '/api/:path*',
}

