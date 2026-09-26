import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { exportInvoicesToTally } from '../utils/tallyExporter';
import { 
  Building2, 
  LogOut, 
  FileText, 
  Plus, 
  TrendingUp, 
  Clock, 
  Calendar,
  Search, 
  Filter,
  User,
  Eye,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  ClipboardList
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { displayName, signOut: authSignOut } = useAuth();

  // State Management
  const [invoices, setInvoices] = useState([]);
  const [pendingQuotationsCount, setPendingQuotationsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Delete State
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');

  // Fetch Invoices & Quotations from Supabase on Mount
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      // Confirm active auth session first before running table query
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        console.error('Session retrieval error on dashboard fetch:', sessionErr);
      }
      if (!session) {
        console.warn('No active session found during dashboard data fetch, redirecting to login.');
        navigate('/login', { replace: true });
        return;
      }

      // Fetch invoices with joined client data
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase dashboard fetch error:', error);
        setFetchError(error.message || 'Failed to fetch invoices from database.');
        setInvoices([]);
      } else {
        setInvoices(data || []);
      }

      // Fetch pending quotations count
      try {
        const { data: qData } = await supabase
          .from('quotations')
          .select('id, status');
        if (qData) {
          const pendingQ = qData.filter(q => q.status !== 'converted').length;
          setPendingQuotationsCount(pendingQ);
        }
      } catch (qErr) {
        console.warn('Quotations fetch notice on dashboard:', qErr);
      }

    } catch (err) {
      console.error('Unexpected error fetching dashboard invoices:', err);
      setFetchError('Connection error while fetching invoice data.');
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Invoice Handler
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const targetId = invoiceToDelete.id;

    try {
      // Step 1: Delete related line items first from invoice_items table
      const { error: itemsDelErr } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', targetId);

      if (itemsDelErr) {
        console.warn('Notice deleting line items:', itemsDelErr.message);
      }

      // Step 2: Delete invoice record from invoices table
      const { error: invoiceDelErr } = await supabase
        .from('invoices')
        .delete()
        .eq('id', targetId);

      if (invoiceDelErr) {
        throw new Error(invoiceDelErr.message || 'Failed to delete invoice record from database.');
      }

      // On success: remove from local state immediately
      setInvoices((prev) => prev.filter((inv) => inv.id !== targetId));
      setIsDeleting(false);
      setInvoiceToDelete(null);
    } catch (err) {
      console.error('Delete invoice exception:', err);
      setIsDeleting(false);
      setDeleteError(err.message || 'Error deleting invoice. Record kept in list.');
    }
  };

  // Export to Tally Handler
  const handleExportTally = async () => {
    if (filteredInvoices.length === 0) {
      setFetchError('No invoices match the current view to export.');
      setTimeout(() => setFetchError(null), 4000);
      return;
    }

    setIsExporting(true);
    try {
      const targetIds = filteredInvoices.map((inv) => inv.id);

      const { data: detailedInvoices, error: fetchErr } = await supabase
        .from('invoices')
        .select('*, clients(name, gstin), invoice_items(*)')
        .in('id', targetIds)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message || 'Failed to fetch invoice details for export.');
      }

      exportInvoicesToTally(detailedInvoices || []);
      setExportSuccessMsg(`Exported ${detailedInvoices?.length || 0} invoices successfully!`);
      setTimeout(() => setExportSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Tally export error:', err);
      setFetchError(err.message || 'Error exporting invoices to Tally Excel.');
      setTimeout(() => setFetchError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Helper formatting function for Indian Rupee
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `₹ ${num.toLocaleString('en-IN')}`;
  };

  // Helper date formatter
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Calculate Summary Statistics from fetched data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalInvoicesCount = invoices.length;

  const thisMonthRevenue = invoices
    .filter((inv) => {
      const invDate = new Date(inv.invoice_date || inv.created_at || inv.date);
      return !isNaN(invDate.getTime()) && invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount || inv.amount) || 0), 0);

  const pendingPaymentsAmount = invoices
    .filter((inv) => (inv.status || '').toLowerCase() === 'pending')
    .reduce((sum, inv) => sum + (parseFloat(inv.total_amount || inv.amount) || 0), 0);

  const pendingCount = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'pending').length;

  const invoicesThisMonthCount = invoices.filter((inv) => {
    const invDate = new Date(inv.invoice_date || inv.created_at || inv.date);
    return !isNaN(invDate.getTime()) && invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
  }).length;

  // Filtered Recent Invoices (limit to latest 6 rows for dashboard display)
  const filteredInvoices = invoices
    .filter((inv) => {
      const buyerName = inv.clients?.name || inv.client_name || inv.buyer_name || inv.buyer || '';
      const invNo = inv.invoice_no || inv.invoice_number || inv.id || '';

      const matchesSearch =
        buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invNo.toLowerCase().includes(searchQuery.toLowerCase());

      const statusVal = (inv.status || '').toLowerCase();
      const filterVal = filterStatus.toLowerCase();
      const matchesFilter = filterStatus === 'All' || statusVal === filterVal;

      return matchesSearch && matchesFilter;
    })
    .slice(0, 6);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans overflow-x-hidden"
    >
      
      {/* Responsive Top Navbar */}
      <Navbar activeTab="dashboard" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Error Alert Banner if fetch fails */}
        {fetchError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between text-xs text-rose-800 font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Success Alert Banner for Tally Export */}
        {exportSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        {/* 5 Summary Stat Cards Grid */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-4">
            
            {/* Stat Card 1: Total Invoices */}
            <div className="bg-[#F4F5F6] p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider">
                  Total Invoices
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-[#5C7A99] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#36454F] mt-3 font-heading">
                {isLoading ? (
                  <span className="animate-pulse bg-slate-300 inline-block h-7 w-14 rounded"></span>
                ) : (
                  totalInvoicesCount
                )}
              </div>
              <div className="text-[11px] text-[#5C7A99] font-medium mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>All time records</span>
              </div>
            </div>

            {/* Stat Card 2: This Month's Revenue */}
            <div className="bg-[#F4F5F6] p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider">
                  This Month's Revenue
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-100/60 text-[#F2A104] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#36454F] mt-3 font-heading">
                {isLoading ? (
                  <span className="animate-pulse bg-slate-300 inline-block h-7 w-24 rounded"></span>
                ) : (
                  formatCurrency(thisMonthRevenue)
                )}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                <span>Current calendar month</span>
              </div>
            </div>

            {/* Stat Card 3: Pending Payments */}
            <div className="bg-[#F4F5F6] p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider">
                  Pending Payments
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#36454F] mt-3 font-heading">
                {isLoading ? (
                  <span className="animate-pulse bg-slate-300 inline-block h-7 w-24 rounded"></span>
                ) : (
                  formatCurrency(pendingPaymentsAmount)
                )}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{pendingCount} {pendingCount === 1 ? 'invoice' : 'invoices'} pending</span>
              </div>
            </div>

            {/* Stat Card 4: Pending Quotations */}
            <div className="bg-[#F4F5F6] p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider">
                  Active Quotes
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-indigo-900 mt-3 font-heading">
                {isLoading ? (
                  <span className="animate-pulse bg-slate-300 inline-block h-7 w-14 rounded"></span>
                ) : (
                  pendingQuotationsCount
                )}
              </div>
              <div className="text-[11px] text-indigo-700 font-semibold mt-1.5">
                <Link to="/quotations" className="hover:underline flex items-center gap-1">
                  <span>View pre-sale quotes</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* Stat Card 5: Invoices This Month */}
            <div className="bg-[#F4F5F6] p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider">
                  Invoices This Month
                </span>
                <div className="w-9 h-9 rounded-xl bg-slate-200/70 text-[#36454F] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#36454F] mt-3 font-heading">
                {isLoading ? (
                  <span className="animate-pulse bg-slate-300 inline-block h-7 w-14 rounded"></span>
                ) : (
                  invoicesThisMonthCount
                )}
              </div>
              <div className="text-[11px] text-[#5C7A99] font-medium mt-1.5">
                Issued in {now.toLocaleString('default', { month: 'short' })} {currentYear}
              </div>
            </div>

          </div>
        </section>

        {/* Recent Invoices Card Section */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 space-y-6">
          
          {/* Section Header: Title & Create New Invoice Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-[#36454F] font-heading">
                Recent Invoices
              </h2>
              <p className="text-xs text-[#5C7A99] mt-0.5">
                Live view of recent GST tax invoices fetched from Supabase
              </p>
            </div>

            {/* Action Buttons: Export to Tally & Create New Invoice */}
            <div className="flex items-center gap-3 self-start md:self-auto">
              <button
                onClick={handleExportTally}
                disabled={isExporting || isLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#5C7A99] hover:bg-[#4a637d] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F2A104]" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-[#F2A104]" />
                    <span>Export to Tally</span>
                  </>
                )}
              </button>

              <Link
                to="/invoice/new"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] font-bold text-xs shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create New Invoice</span>
              </Link>
            </div>
          </div>

          {/* Search Bar + Filter Dropdown */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#F4F5F6] p-3.5 rounded-xl border border-slate-200/70">
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#5C7A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Invoice No. or Buyer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-[#36454F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5C7A99] focus:border-transparent transition-all"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="w-4 h-4 text-[#5C7A99]" />
              <span className="text-xs font-semibold text-[#5C7A99]">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#5C7A99] cursor-pointer shadow-2xs"
              >
                <option value="All">All</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

          </div>

          {/* Desktop Recent Invoices Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Invoice No.</th>
                  <th className="px-5 py-3.5">Buyer Name</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[#36454F]">
                {isLoading ? (
                  // Loading Skeleton Rows
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
                      <td className="px-5 py-4 text-right"><div className="h-4 bg-slate-200 rounded w-12 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => {
                    const invNo = inv.invoice_no || inv.invoice_number || inv.id || 'N/A';
                    const buyerName = inv.clients?.name || inv.client_name || inv.buyer_name || inv.buyer || 'N/A';
                    const invDate = inv.invoice_date || inv.date || inv.created_at;
                    const amountVal = inv.total_amount || inv.amount || 0;
                    const statusVal = inv.status || 'Pending';
                    const isPaid = statusVal.toLowerCase() === 'paid';

                    return (
                      <tr key={inv.id || invNo} className="hover:bg-[#F4F5F6]/60 transition-colors">
                        <td className="px-5 py-4 font-bold text-[#36454F] font-mono">
                          {invNo}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {buyerName}
                        </td>
                        <td className="px-5 py-4 text-[#5C7A99]">
                          {formatDate(invDate)}
                        </td>
                        <td className="px-5 py-4 font-bold font-mono text-[#36454F]">
                          {formatCurrency(amountVal)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            ></span>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/invoice/${inv.id}`)}
                              className="p-2 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/invoice/${inv.id}`)}
                              className="p-2 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Download PDF / Print"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteError(null);
                                setInvoiceToDelete(inv);
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // Empty State Handling
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#5C7A99]">
                      <div className="max-w-sm mx-auto space-y-3">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-[#36454F]">No invoices yet — create your first one!</h4>
                        <p className="text-xs text-slate-400">
                          {searchQuery || filterStatus !== 'All' 
                            ? 'No invoices match your search or status filter.' 
                            : 'Start issuing compliant GST invoices for Krishna Engineering.'}
                        </p>
                        <Link
                          to="/invoice/new"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F2A104] text-[#36454F] font-bold text-xs shadow-sm hover:bg-[#d88f00] transition-colors mt-2"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>Create First Invoice</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Recent Invoices Stacked Cards Layout (Visible only on < md screens) */}
          <div className="block md:hidden space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-4 bg-slate-200 rounded w-36"></div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                </div>
              ))
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => {
                const invNo = inv.invoice_no || inv.invoice_number || inv.id || 'N/A';
                const buyerName = inv.clients?.name || inv.client_name || inv.buyer_name || inv.buyer || 'N/A';
                const invDate = inv.invoice_date || inv.date || inv.created_at;
                const amountVal = inv.total_amount || inv.amount || 0;
                const statusVal = inv.status || 'Pending';
                const isPaid = statusVal.toLowerCase() === 'paid';

                return (
                  <div
                    key={inv.id || invNo}
                    className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold font-mono text-sm text-[#36454F]">{invNo}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#5C7A99] font-medium">Buyer:</span>
                        <span className="font-semibold text-[#36454F] text-right truncate max-w-[180px]">{buyerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#5C7A99] font-medium">Date:</span>
                        <span className="text-slate-600">{formatDate(invDate)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                        <span className="text-[#5C7A99] font-medium">Total Amount:</span>
                        <span className="font-bold font-mono text-sm text-[#36454F]">{formatCurrency(amountVal)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => navigate(`/invoice/${inv.id}`)}
                        className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-[#5C7A99]" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => navigate(`/invoice/${inv.id}`)}
                        className="flex-1 py-2 rounded-lg bg-[#5C7A99] hover:bg-[#4a637d] text-white text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-[#F2A104]" />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setInvoiceToDelete(inv);
                        }}
                        className="py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-[#5C7A99] bg-white rounded-xl border border-slate-200">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-[#36454F]">No invoices found</p>
              </div>
            )}
          </div>

          {/* Footer note inside section */}
          <div className="flex items-center justify-between text-[11px] text-[#5C7A99] pt-1">
            <span>Showing {filteredInvoices.length} of {invoices.length} total invoices</span>
            <span>All values include 18% GST standard rate</span>
          </div>

        </section>

      </main>

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-[#5C7A99]">
          © {new Date().getFullYear()} Krishna Engineering. All GST calculations compliant with CGST/SGST/IGST Act.
        </div>
      </footer>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {invoiceToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#36454F] font-heading">Delete Invoice</h3>
                  <p className="text-xs text-[#5C7A99]">This action cannot be undone.</p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-[#36454F] leading-relaxed">
                Are you sure you want to delete Invoice{' '}
                <span className="font-bold font-mono text-[#36454F]">
                  #{invoiceToDelete.invoice_no || invoiceToDelete.id}
                </span>
                ? This cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold rounded-xl transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all duration-150 hover:scale-[1.02] active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
