'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/painel')
      } else {
        router.replace('/login')
      }
    }
    checkAuth()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-[#ECEEF2] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#181C25] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}