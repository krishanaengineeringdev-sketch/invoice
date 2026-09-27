import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Pencil, 
  Trash2, 
  FileCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Calendar,
  Building2,
  RefreshCw,
  Sparkles,
  MessageCircle,
  Mail,
  Boxes
} from 'lucide-react';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';

export default function DeliveryChallanListPage() {
  const navigate = useNavigate();
  const [shareEmailData, setShareEmailData] = useState(null);

  // State Management
  const [challans, setChallans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPurpose, setFilterPurpose] = useState('All');

  // Delete Modal State
  const [challanToDelete, setChallanToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Fetch Delivery Challans from Supabase
  const fetchChallans = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('delivery_challans')
        .select('*, clients(name), delivery_challan_items(id, description, quantity, per)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching delivery challans:', error);
        setFetchError(error.message || 'Failed to fetch delivery challans.');
        setChallans([]);
      } else {
        setChallans(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching challans:', err);
      setFetchError('Connection error while fetching delivery challans.');
      setChallans([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, []);

  // Filtered Challans
  const filteredChallans = challans.filter((c) => {
    const cNo = (c.challan_no || '').toLowerCase();
    const clientName = (c.clients?.name || '').toLowerCase();
    const vehicle = (c.vehicle_no || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch = !query || cNo.includes(query) || clientName.includes(query) || vehicle.includes(query);
    const matchesStatus = filterStatus === 'All' || (c.status || 'pending').toLowerCase() === filterStatus.toLowerCase();
    const matchesPurpose = filterPurpose === 'All' || (c.purpose || '').toLowerCase() === filterPurpose.toLowerCase();

    return matchesSearch && matchesStatus && matchesPurpose;
  });

  // Calculate Metrics
  const totalChallans = challans.length;
  const pendingChallans = challans.filter((c) => c.status === 'pending').length;
  const deliveredChallans = challans.filter((c) => c.status === 'delivered').length;
  const convertedChallans = challans.filter((c) => c.status === 'converted').length;

  // Handle Delete Challan
  const handleConfirmDelete = async () => {
    if (!challanToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase
        .from('delivery_challans')
        .delete()
        .eq('id', challanToDelete.id);

      if (error) {
        throw new Error(error.message || 'Failed to delete delivery challan.');
      }

      setChallans((prev) => prev.filter((item) => item.id !== challanToDelete.id));
      setChallanToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteError(err.message || 'Error deleting delivery challan.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Convert to Invoice: navigates to invoice creation prefilled with this challan
  const handleConvertToInvoice = (challan) => {
    navigate(`/invoice/new?challanId=${challan.id}`);
  };

  // WhatsApp Share Helper
  const handleWhatsAppShare = (challan) => {
    const itemCount = challan.delivery_challan_items?.length || 0;
    shareViaWhatsApp({
      type: 'Delivery Challan',
      number: challan.challan_no,
      date: formatDate(challan.challan_date),
      amount: `${itemCount} Item(s) (${challan.purpose || 'Job Work'})`,
      buyerName: challan.clients?.name || ''
    });
  };

  // Email Share Helper
  const handleEmailShare = (challan) => {
    const itemCount = challan.delivery_challan_items?.length || 0;
    setShareEmailData({
      type: 'Delivery Challan',
      number: challan.challan_no,
      date: formatDate(challan.challan_date),
      amount: `${itemCount} Item(s) (${challan.purpose || 'Job Work'})`,
      buyerName: challan.clients?.name || '',
      buyerEmail: ''
    });
  };

  // Helper date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Badge color helpers
  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Delivered</span>
        </span>
      );
    }
    if (s === 'converted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <FileCheck className="w-3 h-3 text-indigo-600" />
          <span>Invoiced</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Pending</span>
      </span>
    );
  };

  const getPurposeBadge = (purpose) => {
    const p = purpose || 'Job Work';
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (p === 'Job Work') colorClass = 'bg-sky-50 text-sky-700 border-sky-200';
    if (p === 'Returnable') colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
    if (p === 'Sale on Approval') colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    if (p === 'Sample') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

    return (
      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClass}`}>
        {p}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F5F6] flex flex-col font-sans text-[#36454F]">
      <Navbar activeTab="challans" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#36454F] flex items-center justify-center text-[#F2A104] font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#36454F] font-heading">
                Delivery Challans
              </h1>
            </div>
            <p className="text-xs text-[#5C7A99] font-medium">
              Document non-tax goods dispatch for job-work, returnable materials, and advance delivery
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchChallans}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              to="/challans/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Delivery Challan</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-[#5C7A99] tracking-wider block mb-1">Total Challans</span>
            <span className="text-2xl font-extrabold text-[#36454F] font-mono">{totalChallans}</span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block mb-1">Pending Delivery</span>
            <span className="text-2xl font-extrabold text-amber-600 font-mono">{pendingChallans}</span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block mb-1">Delivered</span>
            <span className="text-2xl font-extrabold text-emerald-600 font-mono">{deliveredChallans}</span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block mb-1">Invoiced</span>
            <span className="text-2xl font-extrabold text-indigo-600 font-mono">{convertedChallans}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Challan No., Buyer, or Vehicle No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F4F5F6] border border-slate-200 text-xs focus:outline-hidden focus:border-[#F2A104] focus:bg-white transition-all text-[#36454F] font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#5C7A99]">Purpose:</span>
              <select
                value={filterPurpose}
                onChange={(e) => setFilterPurpose(e.target.value)}
                className="py-1.5 px-3 rounded-xl bg-[#F4F5F6] border border-slate-200 text-xs font-semibold text-[#36454F] focus:outline-hidden focus:border-[#F2A104]"
              >
                <option value="All">All Purposes</option>
                <option value="Job Work">Job Work</option>
                <option value="Returnable">Returnable</option>
                <option value="Sale on Approval">Sale on Approval</option>
                <option value="Sample">Sample</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#5C7A99]">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="py-1.5 px-3 rounded-xl bg-[#F4F5F6] border border-slate-200 text-xs font-semibold text-[#36454F] focus:outline-hidden focus:border-[#F2A104]"
              >
                <option value="All">All Status</option>
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
                <option value="converted">Invoiced</option>
              </select>
            </div>
          </div>

        </div>

        {/* Challans Table List Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#5C7A99]">
              <Loader2 className="w-8 h-8 animate-spin text-[#F2A104]" />
              <span className="text-xs font-semibold">Loading delivery challans...</span>
            </div>
          ) : fetchError ? (
            <div className="py-16 px-4 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-[#36454F]">Unable to load Delivery Challans</h3>
              <p className="text-xs text-rose-600 max-w-md mx-auto">{fetchError}</p>
              <button
                onClick={fetchChallans}
                className="px-4 py-2 rounded-xl bg-[#36454F] text-white text-xs font-bold hover:bg-[#2c3840] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredChallans.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#F2A104] flex items-center justify-center mx-auto">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#36454F]">No Delivery Challans Found</h3>
              <p className="text-xs text-[#5C7A99] max-w-sm mx-auto">
                {searchQuery || filterStatus !== 'All' || filterPurpose !== 'All'
                  ? 'No challans match your search or filter criteria.'
                  : 'Get started by creating your first Delivery Challan for job-work or material dispatch.'}
              </p>
              <Link
                to="/challans/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#36454F] text-white text-xs font-bold hover:bg-[#2c3840] transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#F2A104]" />
                <span>Create Challan</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">Challan No.</th>
                    <th className="py-3 px-4">Buyer / Consignee</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Vehicle No.</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredChallans.map((challan) => {
                    const itemCount = challan.delivery_challan_items?.length || 0;
                    return (
                      <tr key={challan.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#36454F]">
                          <Link to={`/challan/${challan.id}`} className="hover:text-[#F2A104] transition-colors">
                            {challan.challan_no}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#36454F]">
                          {challan.clients?.name || 'Customer / Consignee'}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                          {formatDate(challan.challan_date)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getPurposeBadge(challan.purpose)}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {challan.vehicle_no || '-'}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Boxes className="w-3.5 h-3.5 text-[#5C7A99]" />
                            <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(challan.status)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Convert to Invoice Button */}
                            {challan.status !== 'converted' && (
                              <button
                                onClick={() => handleConvertToInvoice(challan)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                                title="Convert to GST Invoice"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View / Print Preview */}
                            <Link
                              to={`/challan/${challan.id}`}
                              className="p-1.5 rounded-lg bg-slate-100 text-[#5C7A99] hover:bg-slate-200 hover:text-[#36454F] transition-colors"
                              title="View & Print Challan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>

                            {/* Edit */}
                            <Link
                              to={`/challan/${challan.id}/edit`}
                              className="p-1.5 rounded-lg bg-slate-100 text-[#5C7A99] hover:bg-slate-200 hover:text-[#36454F] transition-colors"
                              title="Edit Challan"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>

                            {/* WhatsApp */}
                            <button
                              onClick={() => handleWhatsAppShare(challan)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Share via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* Email */}
                            <button
                              onClick={() => handleEmailShare(challan)}
                              className="p-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                              title="Share via Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setChallanToDelete(challan)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                              title="Delete Challan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {challanToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#36454F] text-base">Delete Delivery Challan?</h3>
                  <p className="text-xs text-[#5C7A99] font-mono">{challanToDelete.challan_no}</p>
                </div>
              </div>

              <p className="text-xs text-[#5C7A99] leading-relaxed">
                Are you sure you want to permanently delete this delivery challan and its dispatched item records? This action cannot be undone.
              </p>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setChallanToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Email Modal */}
      <ShareEmailModal
        isOpen={!!shareEmailData}
        onClose={() => setShareEmailData(null)}
        shareData={shareEmailData}
      />

    </div>
  );
}
