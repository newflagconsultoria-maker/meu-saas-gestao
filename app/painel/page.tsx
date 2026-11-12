'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Logo } from '@/components/logo'
import {
  Bell,
  Plus,
  ArrowUpRight,
  X,
  Phone,
  Trash2,
  Edit3,
  LogOut,
  Wallet,
  Copy,
  Check,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Calendar,
  Link2,
  ArrowDownCircle,
} from 'lucide-react'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  category: string
  description: string
  total_amount: number
  total_cost: number
  net_profit: number
  payment_method: string
  occurred_at: string
}

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  total_spent: number
  last_visit: string
}

interface CatalogItem {
  id: string
  name: string
  type: 'service' | 'product'
  sale_price: number
  cost_price: number
  stock_qty: number | null
}

interface Profile {
  organization_id: string
  full_name: string
  role: string
  organizations: {
    name: string
    business_type: string
  } | null
}

export default function PainelKeelPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'transactions' | 'catalog'>('overview')
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'month' | 'all'>('today')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros avançados para a aba de transações
  const [txSearch, setTxSearch] = useState('')
  const [txMethodFilter, setTxMethodFilter] = useState<'all' | 'pix' | 'cash' | 'credit_card' | 'debit_card'>('all')

  // Modais e Popovers
  const [showAlerts, setShowAlerts] = useState(false)
  const [alertResolved, setAlertResolved] = useState(false)
  const [showNewTxModal, setShowNewTxModal] = useState(false)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const [showNewCatalogModal, setShowNewCatalogModal] = useState(false)
  const [showCashCloseModal, setShowCashCloseModal] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  // Edição
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null)

  // Formulário PDV
  const [txType, setTxType] = useState<'income' | 'expense'>('income')
  const [txDesc, setTxDesc] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txCost, setTxCost] = useState('')
  const [txMethod, setTxMethod] = useState('pix')
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Formulário Cliente
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')

  // Formulário Catálogo
  const [itemName, setItemName] = useState('')
  const [itemType, setItemType] = useState<'service' | 'product'>('service')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [itemStock, setItemStock] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadAll() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('organization_id, full_name, role, organizations(name, business_type)')
        .eq('id', user.id)
        .single()

      if (profData) setProfile(profData as any)

      const [txRes, custRes, catRes] = await Promise.all([
        supabase.from('transactions').select('*').order('occurred_at', { ascending: false }).limit(200),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('catalog_items').select('*').order('created_at', { ascending: false }),
      ])

      if (txRes.data) setTransactions(txRes.data)
      if (custRes.data) setCustomers(custRes.data)
      if (catRes.data) setCatalog(catRes.data)

      setLoading(false)
    }

    loadAll()

    const channel = supabase
      .channel('keel_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTransactions((prev) => [payload.new as Transaction, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function handleSelectCatalogItem(id: string) {
    setSelectedCatalogId(id)
    const found = catalog.find((c) => c.id === id)
    if (found) {
      setTxDesc(found.name)
      setTxAmount(String(found.sale_price))
      setTxCost(String(found.cost_price))
    }
  }

  // Filtragem temporal
  const filteredTransactions = transactions.filter((t) => {
    if (timeFilter === 'all') return true
    const txDate = new Date(t.occurred_at)
    const now = new Date()

    if (timeFilter === 'today') {
      return (
        txDate.getDate() === now.getDate() &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      )
    }
    if (timeFilter === '7days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(now.getDate() - 7)
      return txDate >= sevenDaysAgo
    }
    if (timeFilter === 'month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
    }
    return true
  })

  // Transações com filtro de busca e método de pagamento (Aba Transações)
  const tabTransactions = filteredTransactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.category.toLowerCase().includes(txSearch.toLowerCase())
    const matchesMethod = txMethodFilter === 'all' || t.payment_method === txMethodFilter
    return matchesSearch && matchesMethod
  })

  // Transações de hoje para Fecho de Caixa
  const todayTransactions = transactions.filter((t) => {
    const txDate = new Date(t.occurred_at)
    const now = new Date()
    return (
      txDate.getDate() === now.getDate() &&
      txDate.getMonth() === now.getMonth() &&
      txDate.getFullYear() === now.getFullYear()
    )
  })

  const todayIncomes = todayTransactions.filter((t) => t.type === 'income')
  const todayExpenses = todayTransactions.filter((t) => t.type === 'expense')
  const todayGrossRevenue = todayIncomes.reduce((acc, t) => acc + Number(t.total_amount), 0)
  const todayTotalExpenses = todayExpenses.reduce((acc, t) => acc + Number(t.total_amount), 0)
  const todayNetProfit = todayTransactions.reduce((acc, t) => acc + Number(t.net_profit), 0)

  const cashInDrawer = todayIncomes
    .filter((t) => t.payment_method === 'cash')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)
  const pixIncomes = todayIncomes
    .filter((t) => t.payment_method === 'pix')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)
  const creditIncomes = todayIncomes
    .filter((t) => t.payment_method === 'credit_card')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)
  const debitIncomes = todayIncomes
    .filter((t) => t.payment_method === 'debit_card')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)

  // Métricas do Período
  const grossRevenue = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)

  const netProfit = filteredTransactions.reduce((acc, t) => acc + Number(t.net_profit), 0)
  const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0
  const cashRatio =
    totalExpenses > 0 ? (grossRevenue / totalExpenses).toFixed(1) : grossRevenue > 0 ? '10.0' : '0.0'
  const incomeCount = filteredTransactions.filter((t) => t.type === 'income').length
  const ticketMedio = incomeCount > 0 ? grossRevenue / incomeCount : 0

  const formattedProfit = Math.abs(netProfit).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const [wholePart, centsPart] = formattedProfit.split(',')

  function handleCopySummary() {
    const text =
      `📊 *FECHO DE CAIXA - ${new Date().toLocaleDateString('pt-BR')}*\n` +
      `🏢 ${profile?.organizations?.name || 'Comércio'}\n\n` +
      `💰 *Faturação Bruta:* R$ ${todayGrossRevenue.toFixed(2)}\n` +
      `🔻 *Despesas:* R$ ${todayTotalExpenses.toFixed(2)}\n` +
      `✨ *Lucro Líquido Real:* R$ ${todayNetProfit.toFixed(2)}\n\n` +
      `*Discriminativo:*\n` +
      `💵 Dinheiro (Gaveta): R$ ${cashInDrawer.toFixed(2)}\n` +
      `⚡ PIX: R$ ${pixIncomes.toFixed(2)}\n` +
      `💳 Cartão de Crédito: R$ ${creditIncomes.toFixed(2)}\n` +
      `💳 Cartão de Débito: R$ ${debitIncomes.toFixed(2)}\n\n` +
      `Total de Vendas: ${todayIncomes.length}`

    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2500)
  }

  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.organization_id) return
    setSubmitting(true)

    const amountNum = parseFloat(txAmount.replace(',', '.')) || 0
    const costNum = txType === 'income' ? parseFloat(txCost.replace(',', '.')) || 0 : 0

    const { error } = await supabase.from('transactions').insert({
      organization_id: profile.organization_id,
      customer_id: selectedCustomerId || null,
      type: txType,
      category: txType === 'income' ? 'Venda / Serviço' : 'Despesa Operacional',
      description: txDesc || (txType === 'income' ? 'Atendimento Balcão' : 'Saída de Caixa'),
      total_amount: amountNum,
      total_cost: costNum,
      payment_method: txMethod,
    })

    if (!error) {
      if (selectedCatalogId && txType === 'income') {
        const item = catalog.find((c) => c.id === selectedCatalogId)
        if (item && item.type === 'product' && item.stock_qty !== null && item.stock_qty > 0) {
          const nextStock = item.stock_qty - 1
          await supabase.from('catalog_items').update({ stock_qty: nextStock }).eq('id', item.id)

          setCatalog((prev) =>
            prev.map((c) => (c.id === item.id ? { ...c, stock_qty: nextStock } : c))
          )
        }
      }

      if (selectedCustomerId && txType === 'income') {
        const cust = customers.find((c) => c.id === selectedCustomerId)
        if (cust) {
          const updatedSpent = Number(cust.total_spent || 0) + amountNum
          await supabase
            .from('customers')
            .update({ total_spent: updatedSpent, last_visit: new Date().toISOString() })
            .eq('id', selectedCustomerId)

          setCustomers((prev) =>
            prev.map((c) =>
              c.id === selectedCustomerId
                ? { ...c, total_spent: updatedSpent, last_visit: new Date().toISOString() }
                : c
            )
          )
        }
      }
    }

    setTxDesc('')
    setTxAmount('')
    setTxCost('')
    setSelectedCatalogId('')
    setSelectedCustomerId('')
    setSubmitting(false)
    setShowNewTxModal(false)
  }

  async function handleDeleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
  }

  async function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.organization_id) return
    setSubmitting(true)

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update({ name: custName, phone: custPhone })
        .eq('id', editingCustomer.id)

      if (!error) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id ? { ...c, name: custName, phone: custPhone } : c
          )
        )
        setEditingCustomer(null)
        setCustName('')
        setCustPhone('')
        setShowNewCustomerModal(false)
      }
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          organization_id: profile.organization_id,
          name: custName,
          phone: custPhone,
        })
        .select()
        .single()

      if (!error && data) {
        setCustomers((prev) => [data, ...prev])
        setCustName('')
        setCustPhone('')
        setShowNewCustomerModal(false)
      }
    }
    setSubmitting(false)
  }

  async function handleDeleteCustomer(id: string) {
    if (!confirm('Deseja realmente remover este cliente?')) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (!error) {
      setCustomers((prev) => prev.filter((c) => c.id !== id))
    }
  }

  async function handleSaveCatalogItem(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.organization_id) return
    setSubmitting(true)

    const salePriceNum = parseFloat(itemPrice.replace(',', '.')) || 0
    const costPriceNum = parseFloat(itemCost.replace(',', '.')) || 0
    const stockQtyNum = itemType === 'product' && itemStock !== '' ? parseInt(itemStock) : null

    if (editingCatalogItem) {
      const { error } = await supabase
        .from('catalog_items')
        .update({
          name: itemName,
          type: itemType,
          sale_price: salePriceNum,
          cost_price: costPriceNum,
          stock_qty: stockQtyNum,
        })
        .eq('id', editingCatalogItem.id)

      if (!error) {
        setCatalog((prev) =>
          prev.map((item) =>
            item.id === editingCatalogItem.id
              ? {
                  ...item,
                  name: itemName,
                  type: itemType,
                  sale_price: salePriceNum,
                  cost_price: costPriceNum,
                  stock_qty: stockQtyNum,
                }
              : item
          )
        )
        setEditingCatalogItem(null)
        setItemName('')
        setItemPrice('')
        setItemCost('')
        setItemStock('')
        setShowNewCatalogModal(false)
      }
    } else {
      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          organization_id: profile.organization_id,
          name: itemName,
          type: itemType,
          sale_price: salePriceNum,
          cost_price: costPriceNum,
          stock_qty: stockQtyNum,
        })
        .select()
        .single()

      if (!error && data) {
        setCatalog((prev) => [data, ...prev])
        setItemName('')
        setItemPrice('')
        setItemCost('')
        setItemStock('')
        setShowNewCatalogModal(false)
      }
    }
    setSubmitting(false)
  }

  async function handleDeleteCatalogItem(id: string) {
    if (!confirm('Deseja excluir este item do catálogo?')) return
    const { error } = await supabase.from('catalog_items').delete().eq('id', id)
    if (!error) {
      setCatalog((prev) => prev.filter((item) => item.id !== id))
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 68 barras verticais no padrão exato do Financial Health Score do Keel
  const healthBars = [
    28, 35, 42, 31, 48, 54, 44, 38, 29, 36, 49, 41, 33, 27, 38, 45, 52,
    40, 32, 24, 29, 34, 28, 36, 41, 33, 25, 30, 37, 43, 39, 48, 56, 62,
    58, 51, 46, 53, 60, 65, 59, 54, 61, 68, 63, 70, 74, 79, 85, 92, 83,
    78, 86, 80, 75, 82, 88, 95, 89, 84, 79, 83, 87, 81, 77, 84, 88, 82,
  ]

  const periodLabel =
    timeFilter === 'today'
      ? 'Hoje'
      : timeFilter === '7days'
      ? 'Últimos 7 dias'
      : timeFilter === 'month'
      ? 'Este Mês'
      : 'Histórico Total'

  return (
    <div className="min-h-screen bg-[#E2E4E8] text-[#181C25] p-2 sm:p-5 md:p-7 font-sans selection:bg-[#71FC8F] selection:text-[#181C25]">
      {/* CANVAS PRINCIPAL CINZA (#ECEDEF) - EXATAMENTE COMO NO KEEL */}
      <div className="max-w-[1440px] mx-auto bg-[#ECEDEF] rounded-[36px] border border-white/60 shadow-[0_30px_90px_rgba(24,28,37,0.10)] px-5 sm:px-8 md:px-10 py-6 md:py-8 relative">
        
        {/* HEADER SUPERIOR: LOGO + FILTROS + BALÕES DE NAVEGAÇÃO FLUTUANTES */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8 relative z-30">
          {/* Esquerda: Logo + Workspace Ativo */}
          <div className="flex items-center gap-4">
            <Logo className="h-7 text-[#181C25]" />
            <div className="h-5 w-px bg-black/10 hidden sm:block" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6F78] block">
                Workspace Ativo
              </span>
              <span className="text-xs font-extrabold text-[#181C25]">
                {profile?.organizations?.name || 'mn02'}
              </span>
            </div>
          </div>

          {/* Centro: Filtro de Período em Pílulas Flutuantes + Fecho de Caixa */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'today', label: 'Hoje' },
              { id: '7days', label: '7 dias' },
              { id: 'month', label: 'Este Mês' },
              { id: 'all', label: 'Total' },
            ].map((f) => {
              const isSelected = timeFilter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id as any)}
                  className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#181C25] text-[#71FC8F] shadow-[0_6px_16px_rgba(24,28,37,0.16)]'
                      : 'bg-white text-[#6B6F78] hover:text-[#181C25] shadow-[0_2px_8px_rgba(24,28,37,0.04)]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}

            <button
              onClick={() => setShowCashCloseModal(true)}
              className="h-9 px-4 rounded-full bg-white text-[#181C25] text-xs font-semibold flex items-center gap-2 shadow-[0_2px_8px_rgba(24,28,37,0.04)] hover:shadow-md transition"
            >
              <Wallet className="w-3.5 h-3.5 text-[#181C25]" />
              Fecho de Caixa
            </button>
          </div>

          {/* Direita: Abas como Balões Individuais Flutuantes + Sino Alerts + Sair */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'customers', label: 'Clientes' },
              { id: 'transactions', label: 'Transações' },
              { id: 'catalog', label: 'Catálogo' },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`h-10 px-5 rounded-full text-[13px] font-semibold transition-all ${
                    isActive
                      ? 'bg-[#181C25] text-white shadow-[0_6px_16px_rgba(24,28,37,0.18)]'
                      : 'bg-white text-[#181C25] hover:bg-white/80 shadow-[0_2px_8px_rgba(24,28,37,0.04)]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}

            {/* Sino de Alertas com Popover Keel ("Four tell you. One asks you.") */}
            <div className="relative ml-1">
              <button
                onClick={() => setShowAlerts(!showAlerts)}
                className="w-10 h-10 rounded-full bg-white shadow-[0_2px_8px_rgba(24,28,37,0.04)] flex items-center justify-center text-[#181C25] hover:shadow-md transition relative"
                title="Alertas"
              >
                <Bell className="w-4 h-4" />
                {!alertResolved && (
                  <span className="w-2 h-2 rounded-full bg-[#FF4D4F] absolute top-2.5 right-2.5 ring-2 ring-white" />
                )}
              </button>

              {showAlerts && (
                <div className="absolute right-0 top-12 w-[340px] sm:w-[370px] bg-white rounded-[26px] shadow-[0_24px_60px_rgba(24,28,37,0.18)] border border-black/5 p-5 z-50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[15px] font-bold text-[#181C25]">Alerts</span>
                    <div className="flex items-center gap-1 bg-[#F4F5F7] p-1 rounded-full text-[11px] font-semibold">
                      <span className="px-2.5 py-0.5 rounded-full bg-white text-[#181C25] shadow-sm">
                        All
                      </span>
                      <span className="px-2.5 py-0.5 text-[#6B6F78]">Unread</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start justify-between p-2.5 rounded-xl hover:bg-[#F8F9FA] transition">
                      <div className="flex items-start gap-2.5">
                        <ArrowDownCircle className="w-4 h-4 text-[#181C25] mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#181C25]">Meta diária projetada</div>
                          <div className="text-[#6B6F78] text-[11px]">
                            {todayIncomes.length} atendimentos registados hoje
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6B6F78]">
                        <span>2h</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4F]" />
                      </div>
                    </div>

                    {!alertResolved ? (
                      <div className="p-3.5 rounded-2xl bg-[#F6F7F9] border border-black/5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-[#181C25] mt-0.5 shrink-0" />
                            <div>
                              <div className="font-bold text-[#181C25]">Conferência pendente</div>
                              <div className="text-[#6B6F78] text-[11px]">
                                Validar saldo de R$ {todayNetProfit.toFixed(2)} no caixa
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#6B6F78]">Agora</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pl-6">
                          <button
                            onClick={() => setAlertResolved(true)}
                            className="px-3.5 py-1.5 rounded-full bg-white border border-black/10 text-[#181C25] font-semibold text-[11px] hover:bg-black/5 transition"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => {
                              setAlertResolved(true)
                              setShowAlerts(false)
                              setShowCashCloseModal(true)
                            }}
                            className="px-4 py-1.5 rounded-full bg-[#181C25] text-white font-semibold text-[11px] hover:opacity-90 transition"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-[#71FC8F]/20 text-[#181C25] text-[11px] font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4" /> Conferência validada com sucesso.
                      </div>
                    )}

                    <div className="flex items-start justify-between p-2.5 rounded-xl hover:bg-[#F8F9FA] transition">
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-[#181C25] mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#181C25]">
                            {customers.length} clientes na base ativa
                          </div>
                          <div className="text-[#6B6F78] text-[11px]">
                            CRM sincronizado com o caixa
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#6B6F78]">5h</span>
                    </div>

                    <div className="flex items-start justify-between p-2.5 rounded-xl hover:bg-[#F8F9FA] transition">
                      <div className="flex items-start gap-2.5">
                        <Calendar className="w-4 h-4 text-[#181C25] mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#181C25]">Catálogo atualizado</div>
                          <div className="text-[#6B6F78] text-[11px]">
                            {catalog.length} itens configurados no workspace
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between p-2.5 rounded-xl hover:bg-[#F8F9FA] transition">
                      <div className="flex items-start gap-2.5">
                        <Link2 className="w-4 h-4 text-[#181C25] mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#181C25]">Supabase Realtime ativo</div>
                          <div className="text-[#6B6F78] text-[11px]">
                             Workspace {profile?.organizations?.name || 'mn02'} • conectado
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botão Sair Flutuante */}
            <button
              onClick={handleSignOut}
              className="w-10 h-10 rounded-full bg-white shadow-[0_2px_8px_rgba(24,28,37,0.04)] flex items-center justify-center text-[#6B6F78] hover:text-rose-600 transition"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* ABA 1: OVERVIEW (CLONE FIEL 1:1 DO HERO SCREEN DO KEEL)   */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* COLUNA ESQUERDA (7 COLUNAS) */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              
              {/* HERO SECTION DIRETO NO FUNDO CINZA (#ECEDEF) - SEM CARD BRANCO AO REDOR */}
              <div className="pt-1 flex flex-col justify-between">
                <div>
                  <div className="text-[15px] font-medium text-[#6B6F78] mb-1 tracking-tight">
                    Lucro Líquido Real ({periodLabel})
                  </div>

                  {/* Número Gigante + Botão Escuro Flutuante */}
                  <div className="flex flex-wrap items-baseline justify-between gap-4 my-1">
                    <div className="text-[52px] sm:text-[68px] xl:text-[76px] font-bold tracking-[-0.04em] leading-none text-[#181C25] select-none">
                      {netProfit < 0 && '-'}R$ {wholePart}
                      <span className="text-[#9CA0A8] font-medium">,{centsPart}</span>
                    </div>

                    <button
                      onClick={() => setShowNewTxModal(true)}
                      className="h-11 px-5 rounded-full bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_10px_24px_rgba(24,28,37,0.22)] hover:scale-[1.02] active:scale-[0.99] transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#71FC8F]" />
                      <span>Lançar no Caixa</span>
                    </button>
                  </div>
                </div>

                {/* 4 MINI-CARDS BRANCOS INDEPENDENTES FLUTUANDO SOBRE O FUNDO CINZA */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {/* Mini-Card 1 */}
                  <div className="bg-white rounded-[22px] p-4 shadow-[0_2px_10px_rgba(24,28,37,0.03)] flex flex-col justify-between min-h-[92px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[22px] font-bold tracking-tight text-[#181C25]">
                        {filteredTransactions.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#71FC8F] text-[#181C25]">
                        Ativo
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[#8C919C]">Lançamentos</span>
                  </div>

                  {/* Mini-Card 2 */}
                  <div className="bg-white rounded-[22px] p-4 shadow-[0_2px_10px_rgba(24,28,37,0.03)] flex flex-col justify-between min-h-[92px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[22px] font-bold tracking-tight text-[#181C25]">
                        R${' '}
                        {grossRevenue >= 1000
                          ? `${(grossRevenue / 1000).toFixed(1)}k`
                          : grossRevenue.toFixed(0)}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[#8C919C]">Faturação Bruta</span>
                  </div>

                  {/* Mini-Card 3 */}
                  <div className="bg-white rounded-[22px] p-4 shadow-[0_2px_10px_rgba(24,28,37,0.03)] flex flex-col justify-between min-h-[92px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[22px] font-bold tracking-tight text-[#181C25]">
                        {customers.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDE8E8] text-[#E5484D]">
                        CRM
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[#8C919C]">Clientes Ativos</span>
                  </div>

                  {/* Mini-Card 4 */}
                  <div className="bg-white rounded-[22px] p-4 shadow-[0_2px_10px_rgba(24,28,37,0.03)] flex flex-col justify-between min-h-[92px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[22px] font-bold tracking-tight text-[#181C25]">
                        {cashRatio}x
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#71FC8F] text-[#181C25]">
                        ↑ OK
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[#8C919C]">Razão de Caixa</span>
                  </div>
                </div>
              </div>

              {/* CARD INFERIOR ESQUERDO: FINANCIAL HEALTH SCORE IDÊNTICO AO KEEL */}
              <div className="bg-white rounded-[28px] p-6 md:p-7 shadow-[0_2px_12px_rgba(24,28,37,0.03)] flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#181C25]">Financial health score</h3>
                    <p className="text-[11px] text-[#8C919C] mt-0.5 leading-relaxed">
                      Equilíbrio entre volume de entradas e custos operacionais no período
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F4F5F7] text-[11px] font-semibold text-[#6B6F78]">
                    Margem Líquida: {profitMargin}%
                  </span>
                </div>

                {/* Área do Gráfico com os 5 Callouts Flutuantes + Barras Verticais */}
                <div className="relative pt-14 pb-2 mt-2">
                  {/* Callout 11% */}
                  <div className="absolute left-[10%] top-4 -translate-x-1/2 flex flex-col items-center z-10">
                    <div className="bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-black/5 rounded-xl px-2.5 py-1 text-center">
                      <div className="text-[11px] font-bold text-[#181C25]">11%</div>
                      <div className="text-[9px] text-[#8C919C]">Critical</div>
                    </div>
                    <div className="w-px h-6 bg-[#CBD0D8]" />
                  </div>

                  {/* Callout 37% */}
                  <div className="absolute left-[28%] top-6 -translate-x-1/2 flex flex-col items-center z-10">
                    <div className="bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-black/5 rounded-xl px-2.5 py-1 text-center">
                      <div className="text-[11px] font-bold text-[#181C25]">37%</div>
                      <div className="text-[9px] text-[#8C919C]">Fragile</div>
                    </div>
                    <div className="w-px h-6 bg-[#CBD0D8]" />
                  </div>

                  {/* Callout 56% */}
                  <div className="absolute left-[48%] top-4 -translate-x-1/2 flex flex-col items-center z-10">
                    <div className="bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-black/5 rounded-xl px-2.5 py-1 text-center">
                      <div className="text-[11px] font-bold text-[#181C25]">56%</div>
                      <div className="text-[9px] text-[#8C919C]">Stable</div>
                    </div>
                    <div className="w-px h-6 bg-[#CBD0D8]" />
                  </div>

                  {/* Callout 77% */}
                  <div className="absolute left-[71%] top-0 -translate-x-1/2 flex flex-col items-center z-10">
                    <div className="bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-black/5 rounded-xl px-2.5 py-1 text-center">
                      <div className="text-[11px] font-bold text-[#181C25]">77%</div>
                      <div className="text-[9px] text-[#8C919C]">Strong</div>
                    </div>
                    <div className="w-px h-8 bg-[#71FC8F]" />
                  </div>

                  {/* Callout Atual (Margem Real) */}
                  <div className="absolute left-[88%] top-2 -translate-x-1/2 flex flex-col items-center z-10">
                    <div className="bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-[#71FC8F] rounded-xl px-2.5 py-1 text-center">
                      <div className="text-[11px] font-bold text-[#181C25]">{profitMargin}%</div>
                      <div className="text-[9px] text-[#8C919C]">Excellent</div>
                    </div>
                    <div className="w-px h-6 bg-[#71FC8F]" />
                  </div>

                  {/* Barras Verticais Estilo Código de Barras */}
                  <div className="h-28 flex items-end gap-[3px] pt-6">
                    {healthBars.map((height, idx) => {
                      const isGreenZone = idx >= 46
                      return (
                        <div
                          key={idx}
                          style={{ height: `${height}%` }}
                          className={`flex-1 rounded-t-sm transition-all duration-500 ${
                            isGreenZone
                              ? 'bg-gradient-to-t from-[#71FC8F]/40 to-[#71FC8F]'
                              : idx >= 22
                              ? 'bg-[#C4C9D2]'
                              : 'bg-[#DCdfe6]'
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Escala de Pílulas Inferior (0 a 100) */}
                <div className="flex items-center justify-between gap-1 pt-3 border-t border-black/5">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((num) => {
                    const isHigh = num >= 80
                    return (
                      <span
                        key={num}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isHigh
                            ? 'bg-[#71FC8F] text-[#181C25]'
                            : 'bg-[#ECEDEF] text-[#6B6F78]'
                        }`}
                      >
                        {num}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA (5 COLUNAS) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4">
              
              {/* 2 CARDS SUPERIORES DA DIREITA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Card Branco: Margem Líquida (3 Colunas + Pílula Verde) */}
                <div className="bg-white rounded-[28px] p-6 shadow-[0_2px_12px_rgba(24,28,37,0.03)] flex flex-col justify-between min-h-[265px]">
                  <div>
                    <p className="text-[11px] text-[#6B6F78] font-medium leading-snug mb-2">
                      Margem líquida da operação no período:
                    </p>
                    <div className="text-[36px] font-bold tracking-tight text-[#181C25] leading-none">
                      {profitMargin}%
                    </div>
                    <span className="text-[11px] text-[#8C919C] mt-1 block">
                      Rentabilidade Real
                    </span>
                  </div>

                  {/* Gráfico de 3 Colunas idêntico ao Keel */}
                  <div className="grid grid-cols-3 gap-2.5 items-end h-28 pt-4">
                    <div className="h-12 rounded-t-xl bg-gradient-to-b from-[#EAECEF] to-transparent border-t-2 border-[#D0D4DC]" />
                    <div className="h-24 rounded-t-xl bg-gradient-to-b from-[#71FC8F]/60 to-transparent relative flex justify-center">
                      <span className=" -top-3 absolute px-2 py-0.5 rounded-full bg-[#71FC8F] text-[#181C25] text-[9px] font-extrabold shadow-sm">
                        {profitMargin}%
                      </span>
                    </div>
                    <div className="h-9 rounded-t-xl bg-gradient-to-b from-[#EAECEF] to-transparent border-t-2 border-[#6B6F78]" />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#8C919C] pt-2">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#71FC8F]" /> Confident
                    </span>
                    <span>Clear</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8C919C]" /> Reliable
                    </span>
                  </div>
                </div>

                {/* Card Preto (#181C25): Despesas / Saídas com Arco Semicircular */}
                <div className="bg-[#181C25] text-white rounded-[28px] p-6 shadow-[0_12px_30px_rgba(24,28,37,0.18)] flex flex-col justify-between min-h-[265px]">
                  <div>
                    <p className="text-[11px] text-[#9CA3AF] font-medium leading-snug mb-2">
                      Despesas / Saídas registadas no período:
                    </p>
                    <div className="text-[34px] font-bold tracking-tight leading-none">
                      R$ {totalExpenses.toFixed(0)}
                    </div>
                    <span className="text-[11px] text-[#9CA3AF] mt-1 block">
                      Saídas operacionais
                    </span>
                  </div>

                  {/* Arco Semicircular Bipartido Idêntico ao Keel */}
                  <div className="my-1 flex justify-center">
                    <svg viewBox="0 0 200 105" className="w-full max-w-[175px] overflow-visible">
                      {/* Arco Esquerdo Cinza */}
                      <path
                        d="M 16 95 A 82 82 0 0 1 88 15"
                        fill="none"
                        stroke="#8C919C"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                      {/* Arco Direito Verde Neon */}
                      <path
                        d="M 102 14 A 82 82 0 0 1 184 95"
                        fill="none"
                        stroke="#71FC8F"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#9CA3AF] pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#71FC8F]" /> Operacional
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8C919C]" /> Insumos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> Fixas
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD INFERIOR DIREITO: TICKET MÉDIO COM FAIXA DIAGONAL HACHURADA DO KEEL */}
              <div className="bg-white rounded-[28px] p-6 md:p-7 shadow-[0_2px_12px_rgba(24,28,37,0.03)] flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6F78]">
                      Ticket Médio no Período
                    </span>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="w-7 h-7 rounded-full border border-black/10 flex items-center justify-center text-[#181C25] hover:bg-[#181C25] hover:text-white transition"
                      title="Ver transações"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[36px] font-bold tracking-tight text-[#181C25] leading-none my-1">
                    R${' '}
                    {ticketMedio.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="text-[11px] text-[#8C919C]">
                    Média de valor por venda realizada ({incomeCount} vendas)
                  </p>
                </div>

                {/* Gráfico de Faixa Hachurada Diagonal Idêntico ao card S&P 500 do Keel */}
                <div className="relative h-28 my-2">
                  <svg viewBox="0 0 400 110" className="w-full h-full overflow-visible">
                    <defs>
                      <pattern
                        id="keelDiagonalHatch"
                        width="6"
                        height="6"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="6"
                          stroke="#D5D8E0"
                          strokeWidth="1.5"
                        />
                      </pattern>
                    </defs>

                    {/* Polígono preenchido com hachura diagonal */}
                    <polygon
                      points="15,78 95,68 180,55 265,38 355,22 385,15 385,55 355,62 265,68 180,75 95,84 15,88"
                      fill="url(#keelDiagonalHatch)"
                      opacity="0.85"
                    />

                    {/* Linhas de contorno suaves */}
                    <polyline
                      fill="none"
                      stroke="#CBD0D8"
                      strokeWidth="1"
                      points="15,78 95,68 180,55 265,38 355,22 385,15"
                    />
                    <polyline
                      fill="none"
                      stroke="#CBD0D8"
                      strokeWidth="1"
                      points="15,88 95,84 180,75 265,68 355,62 385,55"
                    />

                    {/* Pontos de ancoragem */}
                    <circle cx="95" cy="68" r="2.2" fill="#181C25" />
                    <circle cx="95" cy="84" r="2.2" fill="#181C25" />
                    <circle cx="180" cy="55" r="2.2" fill="#181C25" />
                    <circle cx="180" cy="75" r="2.2" fill="#181C25" />
                    <circle cx="355" cy="22" r="2.2" fill="#181C25" />
                    <circle cx="355" cy="62" r="2.2" fill="#181C25" />

                    {/* Haste Vertical de Destaque + Pílula Verde */}
                    <line
                      x1="265"
                      y1="26"
                      x2="265"
                      y2="80"
                      stroke="#181C25"
                      strokeWidth="1.5"
                    />
                    <circle cx="265" cy="26" r="2.5" fill="#181C25" />
                    <circle cx="265" cy="80" r="2.5" fill="#181C25" />
                  </svg>

                  {/* Pílula Verde Flutuante sobre a Haste */}
                  <div className="absolute left-[66%] top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#71FC8F] text-[#181C25] text-[10px] font-extrabold shadow-sm">
                    {cashRatio}x
                  </div>
                </div>

                {/* Rodapé Compacto com os Últimos Lançamentos do Período */}
                {filteredTransactions.length > 0 && (
                  <div className="pt-2.5 border-t border-black/5 flex items-center justify-between gap-2 text-[11px] text-[#6B6F78] truncate">
                    <span className="truncate">
                      Último:{' '}
                      <strong className="text-[#181C25]">
                        {filteredTransactions[0].description}
                      </strong>
                    </span>
                    <strong className="text-[#181C25] shrink-0">
                      {filteredTransactions[0].type === 'income' ? '+' : '-'} R${' '}
                      {Number(filteredTransactions[0].total_amount).toFixed(2)}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 2: CLIENTES                                           */}
        {/* ========================================================= */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 shadow-[0_2px_12px_rgba(24,28,37,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#181C25]">Gestão de Clientes</h2>
                <p className="text-xs text-[#6B6F78]">
                  Histórico de compras, contactos e edição cadastral
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingCustomer(null)
                  setCustName('')
                  setCustPhone('')
                  setShowNewCustomerModal(true)
                }}
                className="px-5 py-2.5 rounded-full bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2 hover:opacity-90"
              >
                <Plus className="w-4 h-4 text-[#71FC8F]" />
                Novo Cliente
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#6B6F78]">
                Nenhum cliente registado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-base text-[#181C25]">{c.name}</h4>
                          <p className="text-xs text-[#6B6F78] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {c.phone || 'Sem contacto'}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-[#71FC8F] text-[#181C25] text-xs font-bold">
                          R$ {Number(c.total_spent || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-4 mt-4 border-t border-black/5">
                      {c.phone ? (
                        <a
                          href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#181C25] hover:underline"
                        >
                          WhatsApp →
                        </a>
                      ) : (
                        <span className="text-[#6B6F78]">Sem telefone</span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCustomer(c)
                            setCustName(c.name)
                            setCustPhone(c.phone || '')
                            setShowNewCustomerModal(true)
                          }}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-[#6B6F78]"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 3: TRANSAÇÕES                                         */}
        {/* ========================================================= */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 shadow-[0_2px_12px_rgba(24,28,37,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#181C25]">Histórico de Transações</h2>
                <p className="text-xs text-[#6B6F78]">
                  Entradas e saídas no período ({periodLabel})
                </p>
              </div>
              <button
                onClick={() => setShowNewTxModal(true)}
                className="px-5 py-2.5 rounded-full bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#71FC8F]" />
                Novo Lançamento
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-2 bg-[#F8F9FB] rounded-2xl border border-black/5">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-black/5 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#6B6F78]" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Pesquisar por descrição..."
                  className="w-full text-xs text-[#181C25] bg-transparent focus:outline-none"
                />
                {txSearch && (
                  <button
                    onClick={() => setTxSearch('')}
                    className="text-[#6B6F78] hover:text-[#181C25]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-[#6B6F78] flex items-center gap-1 pl-1">
                  <Filter className="w-3.5 h-3.5" /> Método:
                </span>
                {(['all', 'pix', 'cash', 'credit_card', 'debit_card'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setTxMethodFilter(method)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      txMethodFilter === method
                        ? 'bg-[#181C25] text-[#71FC8F]'
                        : 'bg-white text-[#6B6F78] border border-black/5 hover:text-[#181C25]'
                    }`}
                  >
                    {method === 'all'
                      ? 'Todos'
                      : method === 'cash'
                      ? 'Dinheiro'
                      : method === 'credit_card'
                      ? 'Crédito'
                      : method === 'debit_card'
                      ? 'Débito'
                      : 'PIX'}
                  </button>
                ))}
              </div>
            </div>

            {tabTransactions.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#6B6F78]">
                Nenhuma transação encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {tabTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="py-4 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          t.type === 'income'
                            ? 'bg-[#71FC8F] text-[#181C25]'
                            : 'bg-[#181C25] text-white'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                      </div>
                      <div>
                        <div className="font-bold text-[#181C25]">{t.description}</div>
                        <div className="text-xs text-[#6B6F78]">
                          {t.payment_method.toUpperCase()} •{' '}
                          {new Date(t.occurred_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-[#181C25]">
                          {t.type === 'income' ? '+' : '-'} R$ {Number(t.total_amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-[#6B6F78]">
                          Lucro Líquido: R$ {Number(t.net_profit).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="p-2 text-[#6B6F78] hover:text-rose-600 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 4: CATÁLOGO                                           */}
        {/* ========================================================= */}
        {activeTab === 'catalog' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 shadow-[0_2px_12px_rgba(24,28,37,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#181C25]">
                  Catálogo de Serviços e Produtos
                </h2>
                <p className="text-xs text-[#6B6F78]">
                  Controle de preços, margem líquida e stock de produtos
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingCatalogItem(null)
                  setItemName('')
                  setItemPrice('')
                  setItemCost('')
                  setItemStock('')
                  setShowNewCatalogModal(true)
                }}
                className="px-5 py-2.5 rounded-full bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#71FC8F]" />
                Adicionar Item
              </button>
            </div>

            {catalog.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#6B6F78]">
                Nenhum serviço ou produto registado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {catalog.map((item) => {
                  const itemProfit = Number(item.sale_price) - Number(item.cost_price)
                  const isOutOfStock =
                    item.type === 'product' && item.stock_qty !== null && item.stock_qty <= 0

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#181C25] text-white">
                              {item.type === 'service' ? 'Serviço' : 'Produto'}
                            </span>
                            {item.type === 'product' && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOutOfStock
                                    ? 'bg-rose-100 text-rose-600'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isOutOfStock ? 'Sem Stock' : `${item.stock_qty ?? 0} em stock`}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCatalogItem(item)
                                setItemName(item.name)
                                setItemType(item.type)
                                setItemPrice(String(item.sale_price))
                                setItemCost(String(item.cost_price))
                                setItemStock(
                                  item.stock_qty !== null ? String(item.stock_qty) : ''
                                )
                                setShowNewCatalogModal(true)
                              }}
                              className="p-1 rounded hover:bg-black/5 text-[#6B6F78]"
                              title="Editar item"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCatalogItem(item.id)}
                              className="p-1 rounded hover:bg-rose-50 text-rose-500"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-base text-[#181C25]">{item.name}</h4>
                      </div>

                      <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[#6B6F78] block">Preço de Venda</span>
                          <strong className="text-sm text-[#181C25]">
                            R$ {Number(item.sale_price).toFixed(2)}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[#6B6F78] block">Lucro Limpo</span>
                          <strong className="text-sm px-2 py-0.5 rounded-lg bg-[#71FC8F] text-[#181C25]">
                            + R$ {itemProfit.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL FECHO DE CAIXA */}
      {showCashCloseModal && (
        <div className="fixed inset-0 bg-[#181C25]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-7 md:p-8 shadow-2xl border border-black/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-[#6B6F78] uppercase tracking-wider block">
                  Conferência do Dia
                </span>
                <h3 className="text-xl font-bold text-[#181C25]">
                  Fecho de Caixa • {new Date().toLocaleDateString('pt-BR')}
                </h3>
              </div>
              <button
                onClick={() => setShowCashCloseModal(false)}
                className="w-9 h-9 rounded-full bg-[#F5F6F8] flex items-center justify-center text-[#6B6F78] hover:bg-black/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#F8F9FB] border border-black/5 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] text-[#6B6F78] block mb-1">Entradas</span>
                <strong className="text-base text-[#181C25] font-bold">
                  R$ {todayGrossRevenue.toFixed(2)}
                </strong>
              </div>

              <div className="bg-[#F8F9FB] border border-black/5 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] text-[#6B6F78] block mb-1">Despesas</span>
                <strong className="text-base text-rose-600 font-bold">
                  R$ {todayTotalExpenses.toFixed(2)}
                </strong>
              </div>

              <div className="bg-[#181C25] text-white rounded-2xl p-3.5 text-center">
                <span className="text-[11px] text-[#71FC8F] block mb-1">Lucro Real</span>
                <strong className="text-base font-bold">R$ {todayNetProfit.toFixed(2)}</strong>
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              <span className="text-xs font-semibold text-[#6B6F78] block">
                Discriminativo dos Recebimentos:
              </span>

              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#71FC8F]/15 to-transparent border border-[#71FC8F]/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#181C25] block">
                    💵 Dinheiro em Espécie (Gaveta)
                  </span>
                  <span className="text-[11px] text-[#6B6F78]">
                    Valor físico que deve estar no caixa
                  </span>
                </div>
                <strong className="text-base font-bold text-[#181C25]">
                  R$ {cashInDrawer.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">
                    ⚡ PIX (Bancário)
                  </span>
                  <span className="text-[11px] text-[#6B6F78]">Entradas em conta</span>
                </div>
                <strong className="text-sm font-bold text-[#181C25]">
                  R$ {pixIncomes.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">
                    💳 Cartão de Crédito
                  </span>
                  <span className="text-[11px] text-[#6B6F78]">
                    Recebimentos processados em crédito
                  </span>
                </div>
                <strong className="text-sm font-bold text-[#181C25]">
                  R$ {creditIncomes.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">
                    💳 Cartão de Débito
                  </span>
                  <span className="text-[11px] text-[#6B6F78]">
                    Recebimentos processados em débito
                  </span>
                </div>
                <strong className="text-sm font-bold text-[#181C25]">
                  R$ {debitIncomes.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopySummary}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#F5F6F8] hover:bg-black/5 text-[#181C25] text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    Copiado para o Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#6B6F78]" />
                    Copiar Resumo (WhatsApp)
                  </>
                )}
              </button>

              <button
                onClick={() => setShowCashCloseModal(false)}
                className="py-3 px-6 rounded-2xl bg-[#181C25] text-white text-xs font-bold hover:opacity-90"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PDV */}
      {showNewTxModal && (
        <div className="fixed inset-0 bg-[#181C25]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-md w-full p-7 shadow-2xl border border-black/5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#181C25]">Lançamento Rápido de Caixa</h3>
              <button
                onClick={() => setShowNewTxModal(false)}
                className="w-8 h-8 rounded-full bg-[#F5F6F8] flex items-center justify-center text-[#6B6F78]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F6F8] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${
                    txType === 'income'
                      ? 'bg-[#71FC8F] text-[#181C25] shadow-sm'
                      : 'text-[#6B6F78]'
                  }`}
                >
                  + Entrada / Venda
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${
                    txType === 'expense'
                      ? 'bg-[#181C25] text-white shadow-sm'
                      : 'text-[#6B6F78]'
                  }`}
                >
                  - Saída / Despesa
                </button>
              </div>

              {txType === 'income' && catalog.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Selecionar do Catálogo (Preenche valor, custo e dá baixa)
                  </label>
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => handleSelectCatalogItem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-xs font-medium text-[#181C25] focus:outline-none"
                  >
                    <option value="">Lançamento Avulso (Sem catálogo)</option>
                    {catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — R$ {Number(item.sale_price).toFixed(2)}{' '}
                        {item.type === 'product' && item.stock_qty !== null
                          ? `(${item.stock_qty} restam)`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {txType === 'income' && customers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Vincular a Cliente (Opcional)
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-xs font-medium text-[#181C25] focus:outline-none"
                  >
                    <option value="">Cliente Balcão (Não registado)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder={
                    txType === 'income'
                      ? 'Ex: Corte Degradê ou Pomada Matte'
                      : 'Ex: Compra de Lâminas / Luz'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm font-bold text-[#181C25] focus:outline-none"
                  />
                </div>

                {txType === 'income' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                      Custo Direto (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={txCost}
                      onChange={(e) => setTxCost(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={txMethod}
                  onChange={(e) => setTxMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-xs font-semibold text-[#181C25] focus:outline-none"
                >
                  <option value="pix">PIX</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-full bg-[#181C25] text-white font-bold text-xs hover:opacity-95 transition mt-2"
              >
                {submitting ? 'A registar...' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CLIENTE */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-[#181C25]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#181C25]">
                {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="text-[#6B6F78]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="Ex: 54999999999"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-full bg-[#71FC8F] text-[#181C25] font-bold text-xs"
              >
                {editingCustomer ? 'Guardar Alterações' : 'Registar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATÁLOGO */}
      {showNewCatalogModal && (
        <div className="fixed inset-0 bg-[#181C25]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#181C25]">
                {editingCatalogItem ? 'Editar Item' : 'Novo Serviço / Produto'}
              </h3>
              <button
                onClick={() => setShowNewCatalogModal(false)}
                className="text-[#6B6F78]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCatalogItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Tipo</label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-xs font-bold text-[#181C25]"
                >
                  <option value="service">Serviço Prestado</option>
                  <option value="product">Produto Vendido</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex: Alinhamento ou Pomada Modeladora"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Preço Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="60,00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm font-bold text-[#181C25]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    placeholder="15,00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25]"
                  />
                </div>
              </div>

              {itemType === 'product' && (
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">
                    Quantidade em Stock
                  </label>
                  <input
                    type="number"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-full bg-[#181C25] text-white font-bold text-xs"
              >
                {editingCatalogItem ? 'Guardar Item' : 'Adicionar ao Catálogo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}