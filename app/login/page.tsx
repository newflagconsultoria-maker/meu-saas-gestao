'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowUpRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('hybrid')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              business_type: businessType,
            },
          },
        })
        if (error) throw error
        router.push('/painel')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/painel')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ECEEF2] text-[#181C25] flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-10 shadow-[0_24px_60px_rgba(24,28,37,0.08)] border border-black/5">
        
        <div className="flex items-center justify-between mb-8">
          <div className="w-11 h-11 rounded-2xl bg-[#181C25] text-white flex items-center justify-center font-black text-xl">
            K
          </div>
          <span className="px-3 py-1 rounded-full bg-[#71FC8F] text-[#181C25] text-xs font-bold">
            Live Cash SaaS
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#181C25] mb-2">
          {isSignUp ? 'Crie o caixa da sua empresa.' : 'Saiba sua posição de caixa hoje.'}
        </h1>
        <p className="text-xs text-[#6B6F78] mb-8">
          {isSignUp
            ? 'Ambiente isolado e seguro para acompanhar lucro líquido em tempo real.'
            : 'Entre com suas credenciais para abrir o painel financeiro.'}
        </p>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Seu nome</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F6F8] rounded-2xl text-sm text-[#181C25] focus:outline-none focus:ring-2 focus:ring-[#181C25]"
                  placeholder="Ex: Ygor"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Nome do Comércio / Empresa</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F6F8] rounded-2xl text-sm text-[#181C25] focus:outline-none focus:ring-2 focus:ring-[#181C25]"
                  placeholder="Ex: Barbearia ou Comércio Local"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Modelo de Operação</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F6F8] rounded-2xl text-sm font-medium text-[#181C25] focus:outline-none"
                >
                  <option value="service">Prestação de Serviços</option>
                  <option value="retail">Comércio / Venda de Produtos</option>
                  <option value="hybrid">Híbrido (Serviços + Produtos)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#6B6F78] mb-1">E-mail corporativo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F6F8] rounded-2xl text-sm text-[#181C25] focus:outline-none focus:ring-2 focus:ring-[#181C25]"
              placeholder="voce@empresa.com.br"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F6F8] rounded-2xl text-sm text-[#181C25] focus:outline-none focus:ring-2 focus:ring-[#181C25]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-[#181C25] hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-2xl text-xs transition-all mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Criar Workspace agora' : 'Acessar Dashboard'}
                <ArrowUpRight className="w-4 h-4 text-[#71FC8F]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-black/5 text-center text-xs text-[#6B6F78]">
          {isSignUp ? 'Já possui um comércio cadastrado?' : 'Novo por aqui?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg(null)
            }}
            className="text-[#181C25] font-bold hover:underline ml-1"
          >
            {isSignUp ? 'Fazer Login' : 'Cadastrar Empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}