'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  Bell, 
  Plus, 
  ArrowUpRight, 
  X, 
  Phone, 
  Trash2, 
  Edit3, 
  LogOut,
  Calendar,
  Wallet,
  Copy,
  Check,
  Search,
  Filter,
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

  // Modais
  const [showAlerts, setShowAlerts] = useState(false)
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
      const { data: { user } } = await supabase.auth.getUser()
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
        supabase.from('catalog_items').select('*').order('created_at', { ascending: false })
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
      return (
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      )
    }
    return true
  })

  // Transações com filtro de busca e método de pagamento (Aba Transações)
  const tabTransactions = filteredTransactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(txSearch.toLowerCase()) ||
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

  const cashInDrawer = todayIncomes.filter((t) => t.payment_method === 'cash').reduce((acc, t) => acc + Number(t.total_amount), 0)
  const pixIncomes = todayIncomes.filter((t) => t.payment_method === 'pix').reduce((acc, t) => acc + Number(t.total_amount), 0)
  const creditIncomes = todayIncomes.filter((t) => t.payment_method === 'credit_card').reduce((acc, t) => acc + Number(t.total_amount), 0)
  const debitIncomes = todayIncomes.filter((t) => t.payment_method === 'debit_card').reduce((acc, t) => acc + Number(t.total_amount), 0)

  // Métricas do Período
  const grossRevenue = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)

  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.total_amount), 0)

  const netProfit = filteredTransactions.reduce((acc, t) => acc + Number(t.net_profit), 0)
  const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0
  const cashRatio = totalExpenses > 0 ? (grossRevenue / totalExpenses).toFixed(1) : grossRevenue > 0 ? '10.0' : '0.0'
  const ticketMedio = filteredTransactions.filter((t) => t.type === 'income').length > 0
    ? grossRevenue / filteredTransactions.filter((t) => t.type === 'income').length
    : 0

  const formattedProfit = Math.abs(netProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [wholePart, centsPart] = formattedProfit.split(',')

  function handleCopySummary() {
    const text = `📊 *FECHO DE CAIXA - ${new Date().toLocaleDateString('pt-BR')}*\n` +
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

  // Lançamento com baixa de stock automática
  async function handleCreateTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.organization_id) return
    setSubmitting(true)

    const amountNum = parseFloat(txAmount.replace(',', '.')) || 0
    const costNum = txType === 'income' ? (parseFloat(txCost.replace(',', '.')) || 0) : 0

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
      // Baixa no stock se o item for um produto e possuir quantidade registada
      if (selectedCatalogId && txType === 'income') {
        const item = catalog.find((c) => c.id === selectedCatalogId)
        if (item && item.type === 'product' && item.stock_qty !== null && item.stock_qty > 0) {
          const nextStock = item.stock_qty - 1
          await supabase
            .from('catalog_items')
            .update({ stock_qty: nextStock })
            .eq('id', item.id)

          setCatalog((prev) =>
            prev.map((c) => (c.id === item.id ? { ...c, stock_qty: nextStock } : c))
          )
        }
      }

      // Atualiza o acumulado de gastos do cliente
      if (selectedCustomerId && txType === 'income') {
        const cust = customers.find((c) => c.id === selectedCustomerId)
        if (cust) {
          const updatedSpent = Number(cust.total_spent || 0) + amountNum
          await supabase
            .from('customers')
            .update({ total_spent: updatedSpent, last_visit: new Date().toISOString() })
            .eq('id', selectedCustomerId)
          
          setCustomers((prev) =>
            prev.map((c) => (c.id === selectedCustomerId ? { ...c, total_spent: updatedSpent, last_visit: new Date().toISOString() } : c))
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

  // Ações de Cliente
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
          prev.map((c) => (c.id === editingCustomer.id ? { ...c, name: custName, phone: custPhone } : c))
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

  // Ações de Catálogo
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
              ? { ...item, name: itemName, type: itemType, sale_price: salePriceNum, cost_price: costPriceNum, stock_qty: stockQtyNum }
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

  const healthBars = Array.from({ length: 64 }, (_, i) => {
    const base = Math.sin(i * 0.25) * 25 + 45 + ((i * 7) % 25)
    return Math.min(95, Math.max(18, Math.round(base)))
  })

  return (
    <div className="min-h-screen bg-[#ECEEF2] text-[#181C25] p-3 md:p-6 font-sans selection:bg-[#71FC8F] selection:text-[#181C25]">
      <div className="max-w-[1400px] mx-auto bg-[#F5F6F8] rounded-[32px] border border-white/80 shadow-[0_20px_60px_rgba(24,28,37,0.08)] p-5 md:p-8 relative">
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-[#181C25] text-white flex items-center justify-center font-black text-xl shadow-sm">
              K
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#6B6F78] block">
                Workspace Ativo
              </span>
              <h2 className="text-base font-bold text-[#181C25]">
                {profile?.organizations?.name || 'A carregar empresa...'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <nav className="flex items-center gap-1.5 bg-[#EAECEF] p-1.5 rounded-2xl">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'customers', label: 'Clientes' },
                { id: 'transactions', label: 'Transações' },
                { id: 'catalog', label: 'Catálogo' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#181C25] text-white shadow-sm'
                      : 'text-[#181C25] hover:bg-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="w-10 h-10 rounded-2xl bg-white border border-black/5 flex items-center justify-center text-[#181C25] hover:bg-black/5 transition relative"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-[#FF5A36] absolute top-2.5 right-2.5" />
            </button>

            <button
              onClick={handleSignOut}
              title="Terminar sessão"
              className="w-10 h-10 rounded-2xl bg-white border border-black/5 flex items-center justify-center text-[#6B6F78] hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* BARRA DE FILTRO DE DATA + BOTÃO FECHO DE CAIXA */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-black/5 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B6F78]">
            <Calendar className="w-4 h-4" />
            <span>Período do Caixa:</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
              {[
                { id: 'today', label: 'Hoje' },
                { id: '7days', label: 'Últimos 7 dias' },
                { id: 'month', label: 'Este Mês' },
                { id: 'all', label: 'Histórico Total' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    timeFilter === f.id
                      ? 'bg-[#181C25] text-[#71FC8F]'
                      : 'text-[#6B6F78] hover:text-[#181C25]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCashCloseModal(true)}
              className="px-4 py-2 rounded-2xl bg-white border border-black/10 text-xs font-bold text-[#181C25] flex items-center gap-2 hover:bg-[#181C25] hover:text-white transition-all shadow-sm"
            >
              <Wallet className="w-4 h-4 text-[#71FC8F]" />
              Fecho de Caixa
            </button>
          </div>
        </div>

        {/* ABA 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-gradient-to-br from-white via-white to-[#71FC8F]/20 rounded-[28px] p-6 md:p-8 border border-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <span className="text-sm font-medium text-[#6B6F78]">
                    Lucro Líquido Real ({timeFilter === 'today' ? 'Hoje' : timeFilter === '7days' ? '7 Dias' : timeFilter === 'month' ? 'Este Mês' : 'Total'})
                  </span>
                  <button
                    onClick={() => setShowNewTxModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2 hover:bg-[#181C25]/90 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-[#71FC8F]" />
                    + Lançar no Caixa
                  </button>
                </div>

                <div className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#181C25] my-4">
                  {netProfit < 0 && '-'}R$ {wholePart}
                  <span className="text-[#6B6F78] font-medium">,{centsPart}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                  <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-black/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-bold text-[#181C25]">{filteredTransactions.length}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#71FC8F] text-[#181C25]">
                        Ativo
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B6F78] block">Lançamentos</span>
                  </div>

                  <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-black/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-bold text-[#181C25]">
                        R$ {grossRevenue >= 1000 ? `${(grossRevenue / 1000).toFixed(1)}k` : grossRevenue.toFixed(0)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B6F78] block">Faturação Bruta</span>
                  </div>

                  <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-black/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-bold text-[#181C25]">{customers.length}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600">
                        CRM
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B6F78] block">Clientes Ativos</span>
                  </div>

                  <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-black/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-bold text-[#181C25]">{cashRatio}x</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#71FC8F] text-[#181C25]">
                        ↑ OK
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B6F78] block">Razão de Caixa</span>
                  </div>
                </div>
              </div>

              {/* Health Score */}
              <div className="bg-white rounded-[28px] p-6 md:p-7 border border-black/5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-[#181C25]">Financial health score</h3>
                  <span className="px-3 py-1 rounded-full bg-[#F5F6F8] text-[11px] font-semibold text-[#6B6F78]">
                    Margem Líquida: {profitMargin}%
                  </span>
                </div>
                <p className="text-xs text-[#6B6F78] mb-6">
                  Equilíbrio entre volume de entradas e custos operacionais
                </p>

                <div className="h-28 flex items-end gap-[3px]">
                  {healthBars.map((height, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${height}%` }}
                      className={`flex-1 rounded-t-full transition-all duration-500 ${
                        idx >= 38 ? 'bg-[#71FC8F]' : 'bg-[#D5D9E0]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-[28px] p-6 border border-black/5 shadow-sm flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-[#181C25] font-medium leading-relaxed mb-3">
                      Margem líquida da operação no período:
                    </p>
                    <div className="text-4xl font-bold text-[#181C25]">{profitMargin}%</div>
                    <span className="text-xs text-[#6B6F78]">Rentabilidade Real</span>
                  </div>
                  <div className="h-24 flex items-end gap-2 my-4">
                    <div className="flex-1 h-12 bg-[#F5F6F8] rounded-t-xl" />
                    <div className="flex-1 h-8 bg-[#F5F6F8] rounded-t-xl" />
                    <div className="flex-1 h-20 bg-gradient-to-b from-[#71FC8F]/80 to-[#71FC8F]/10 rounded-t-xl border-t-2 border-[#71FC8F]" />
                    <div className="flex-1 h-6 bg-[#D8DCE3] rounded-t-xl" />
                  </div>
                </div>

                <div className="bg-[#181C25] text-white rounded-[28px] p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-[#9CA3AF] block mb-1">Despesas / Saídas</span>
                    <div className="text-3xl font-bold tracking-tight">
                      R$ {totalExpenses.toFixed(0)}
                    </div>
                    <span className="text-xs text-[#9CA3AF] mt-1 block">
                      Registos no período
                    </span>
                  </div>
                  <div className="my-2 flex justify-center">
                    <svg viewBox="0 0 200 100" className="w-full max-w-[160px]">
                      <path
                        d="M 15 90 A 75 75 0 0 1 185 90"
                        fill="none"
                        stroke="#2A303C"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 15 90 A 75 75 0 0 1 150 45"
                        fill="none"
                        stroke="#71FC8F"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[28px] p-6 border border-black/5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B6F78]">
                    Ticket Médio no Período
                  </span>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-[#181C25] hover:bg-[#181C25] hover:text-white transition"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-4xl font-bold text-[#181C25] mb-1">
                  R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-[#6B6F78] mb-4">
                  Média de valor por venda realizada
                </p>

                <div className="space-y-2 border-t border-black/5 pt-3">
                  {filteredTransactions.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-[#71FC8F]' : 'bg-rose-500'}`} />
                        <span className="font-semibold text-[#181C25] truncate max-w-[150px]">{t.description}</span>
                      </div>
                      <span className="font-bold text-[#181C25]">
                        {t.type === 'income' ? '+' : '-'} R$ {Number(t.total_amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CLIENTES */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 border border-black/5 shadow-sm">
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
                className="px-5 py-2.5 rounded-2xl bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2 hover:opacity-90"
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
                  <div key={c.id} className="p-5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex flex-col justify-between">
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
                      ) : <span className="text-[#6B6F78]">Sem telefone</span>}

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

        {/* ABA 3: TRANSAÇÕES COM PESQUISA E FILTRO DE PAGAMENTO */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 border border-black/5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#181C25]">Histórico de Transações</h2>
                <p className="text-xs text-[#6B6F78]">
                  Entradas e saídas no período ({timeFilter === 'today' ? 'Hoje' : timeFilter === '7days' ? '7 dias' : timeFilter === 'month' ? 'Este Mês' : 'Total'})
                </p>
              </div>
              <button
                onClick={() => setShowNewTxModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#71FC8F]" />
                Novo Lançamento
              </button>
            </div>

            {/* Barra de Filtros e Pesquisa */}
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
                  <button onClick={() => setTxSearch('')} className="text-[#6B6F78] hover:text-[#181C25]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#6B6F78] flex items-center gap-1 pl-1">
                  <Filter className="w-3.5 h-3.5" /> Método:
                </span>
                {(['all', 'pix', 'cash', 'credit_card', 'debit_card'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setTxMethodFilter(method)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      txMethodFilter === method
                        ? 'bg-[#181C25] text-[#71FC8F]'
                        : 'bg-white text-[#6B6F78] border border-black/5 hover:text-[#181C25]'
                    }`}
                  >
                    {method === 'all' ? 'Todos' : method === 'cash' ? 'Dinheiro' : method.toUpperCase()}
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
                  <div key={t.id} className="py-4 flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                          t.type === 'income' ? 'bg-[#71FC8F] text-[#181C25]' : 'bg-[#181C25] text-white'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                      </div>
                      <div>
                        <div className="font-bold text-[#181C25]">{t.description}</div>
                        <div className="text-xs text-[#6B6F78]">
                          {t.payment_method.toUpperCase()} • {new Date(t.occurred_at).toLocaleString('pt-BR')}
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

        {/* ABA 4: CATÁLOGO COM INDICADORES DE STOCK */}
        {activeTab === 'catalog' && (
          <div className="bg-white rounded-[28px] p-6 md:p-8 border border-black/5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#181C25]">Catálogo de Serviços e Produtos</h2>
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
                className="px-5 py-2.5 rounded-2xl bg-[#181C25] text-white text-xs font-semibold flex items-center gap-2"
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
                  const isOutOfStock = item.type === 'product' && item.stock_qty !== null && item.stock_qty <= 0

                  return (
                    <div key={item.id} className="p-5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#181C25] text-white">
                              {item.type === 'service' ? 'Serviço' : 'Produto'}
                            </span>
                            {item.type === 'product' && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOutOfStock ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                              }`}>
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
                                setItemStock(item.stock_qty !== null ? String(item.stock_qty) : '')
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
                <strong className="text-base font-bold">
                  R$ {todayNetProfit.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              <span className="text-xs font-semibold text-[#6B6F78] block">
                Discriminativo dos Recebimentos:
              </span>

              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#71FC8F]/15 to-transparent border border-[#71FC8F]/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#181C25] block">💵 Dinheiro em Espécie (Gaveta)</span>
                  <span className="text-[11px] text-[#6B6F78]">Valor físico que deve estar no caixa</span>
                </div>
                <strong className="text-base font-bold text-[#181C25]">
                  R$ {cashInDrawer.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">⚡ PIX (Bancário)</span>
                  <span className="text-[11px] text-[#6B6F78]">Entradas em conta</span>
                </div>
                <strong className="text-sm font-bold text-[#181C25]">
                  R$ {pixIncomes.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">💳 Cartão de Crédito</span>
                  <span className="text-[11px] text-[#6B6F78]">Recebimentos processados em crédito</span>
                </div>
                <strong className="text-sm font-bold text-[#181C25]">
                  R$ {creditIncomes.toFixed(2)}
                </strong>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FB] border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#181C25] block">💳 Cartão de Débito</span>
                  <span className="text-[11px] text-[#6B6F78]">Recebimentos processados em débito</span>
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
              <button onClick={() => setShowNewTxModal(false)} className="w-8 h-8 rounded-full bg-[#F5F6F8] flex items-center justify-center text-[#6B6F78]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F6F8] rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${
                    txType === 'income' ? 'bg-[#71FC8F] text-[#181C25] shadow-sm' : 'text-[#6B6F78]'
                  }`}
                >
                  + Entrada / Venda
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition ${
                    txType === 'expense' ? 'bg-[#181C25] text-white shadow-sm' : 'text-[#6B6F78]'
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
                        {item.name} — R$ {Number(item.sale_price).toFixed(2)} {item.type === 'product' && item.stock_qty !== null ? `(${item.stock_qty} restam)` : ''}
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
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder={txType === 'income' ? 'Ex: Corte Degradê ou Pomada Matte' : 'Ex: Compra de Lâminas / Luz'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] text-sm text-[#181C25] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Valor Total (R$)</label>
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
                    <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Custo Direto (R$)</label>
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
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Forma de Pagamento</label>
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
                className="w-full py-3.5 rounded-2xl bg-[#181C25] text-white font-bold text-xs hover:opacity-95 transition mt-2"
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
              <button onClick={() => setShowNewCustomerModal(false)} className="text-[#6B6F78]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Nome Completo</label>
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
                <label className="block text-xs font-semibold text-[#6B6F78] mb-1">WhatsApp</label>
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
                className="w-full py-3 rounded-2xl bg-[#71FC8F] text-[#181C25] font-bold text-xs"
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
              <button onClick={() => setShowNewCatalogModal(false)} className="text-[#6B6F78]">
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
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Preço Venda (R$)</label>
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
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Custo (R$)</label>
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
                  <label className="block text-xs font-semibold text-[#6B6F78] mb-1">Quantidade em Stock</label>
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
                className="w-full py-3 rounded-2xl bg-[#181C25] text-white font-bold text-xs"
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