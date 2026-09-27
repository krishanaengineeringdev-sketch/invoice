import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Truck, 
  UserCheck, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Calendar,
  Sparkles,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';

// Indian Financial Year calculation helper (April 1 to March 31)
function getIndianFinancialYear(dateObj = new Date()) {
  const month = dateObj.getMonth();
  const year = dateObj.getFullYear();
  let startYear = year;
  let endYear = year + 1;

  if (month < 3) {
    startYear = year - 1;
    endYear = year;
  }

  const endYearShort = String(endYear).slice(-2);
  return `${startYear}-${endYearShort}`;
}

export default function CreateDeliveryChallanPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // ID present in Edit mode

  // Header Details State
  const [challanNo, setChallanNo] = useState('');
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('Job Work');
  const [status, setStatus] = useState('pending');

  // Buyer Details State
  const [clientId, setClientId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerOrderNo, setBuyerOrderNo] = useState('');
  const [buyerOrderDate, setBuyerOrderDate] = useState('');

  // Dispatch Details State
  const [vehicleNo, setVehicleNo] = useState('');
  const [dispatchThrough, setDispatchThrough] = useState('ROAD');
  const [destination, setDestination] = useState('COIMBATORE');

  // Materials Catalog State
  const [materialsCatalog, setMaterialsCatalog] = useState([]);
  const [clientsList, setClientsList] = useState([]);

  // Line Items State (no Rate, Disc%, Amount)
  const [items, setItems] = useState([
    {
      id: 1,
      mode: 'existing',
      selectedMaterialId: '',
      description: '',
      hsn_sac: '8302',
      quantity: 1,
      per: 'NOS',
      remarks: '',
    },
  ]);

  // Loading & Alert States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Load Materials Catalog and Clients List on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matRes, clientRes] = await Promise.all([
          supabase.from('materials').select('*').order('name', { ascending: true }),
          supabase.from('clients').select('*').order('name', { ascending: true })
        ]);

        if (matRes.data) setMaterialsCatalog(matRes.data);
        if (clientRes.data) setClientsList(clientRes.data);
      } catch (err) {
        console.warn('Error loading initial options:', err);
      }
    };
    fetchData();
  }, []);

  // Initialize: Edit Mode (load existing) OR New Mode (auto-generate Challan No: DC-1(2026-27))
  useEffect(() => {
    const initializeForm = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      if (id) {
        // EDIT MODE
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('delivery_challans')
            .select('*, clients(*), delivery_challan_items(*)')
            .eq('id', id)
            .single();

          if (error || !data) {
            setSaveError('Failed to load requested delivery challan.');
          } else {
            setChallanNo(data.challan_no || '');
            setChallanDate(data.challan_date || new Date().toISOString().split('T')[0]);
            setPurpose(data.purpose || 'Job Work');
            setStatus(data.status || 'pending');
            setVehicleNo(data.vehicle_no || '');
            setBuyerOrderNo(data.buyer_order_no || '');
            setDispatchThrough(data.dispatch_through || 'ROAD');
            setDestination(data.destination || '');
            setClientId(data.client_id || '');

            if (data.clients) {
              setBuyerName(data.clients.name || '');
              setBuyerAddress(data.clients.address || '');
              setBuyerGstin(data.clients.gstin || '');
              setBuyerEmail(data.clients.email || '');
            }

            if (data.delivery_challan_items && data.delivery_challan_items.length > 0) {
              setItems(
                data.delivery_challan_items.map((item, idx) => ({
                  id: item.id || idx + 1,
                  mode: 'new',
                  selectedMaterialId: '',
                  description: item.description || '',
                  hsn_sac: item.hsn_sac || '',
                  quantity: parseFloat(item.quantity) || 1,
                  per: item.per || 'NOS',
                  remarks: item.remarks || '',
                }))
              );
            }
          }
        } catch (err) {
          console.error('Error fetching delivery challan:', err);
          setSaveError('Error connecting to database.');
        } finally {
          setIsLoading(false);
        }
      } else {
        // NEW MODE: Auto-generate Challan Number: DC-1(2026-27)
        try {
          const fy = getIndianFinancialYear();
          const { data: latestChallans } = await supabase
            .from('delivery_challans')
            .select('challan_no')
            .order('created_at', { ascending: false })
            .limit(10);

          let nextSeq = 1;
          if (latestChallans && latestChallans.length > 0) {
            const matches = latestChallans
              .map((c) => {
                const m = c.challan_no?.match(/DC-(\d+)/i) || c.challan_no?.match(/(\d+)/);
                return m ? parseInt(m[1] || m[0], 10) : 0;
              })
              .filter(Boolean);
            if (matches.length > 0) {
              nextSeq = Math.max(...matches) + 1;
            }
          }
          setChallanNo(`DC-${nextSeq}(${fy})`);
        } catch (err) {
          console.error('Error auto-generating challan number:', err);
          const fy = getIndianFinancialYear();
          setChallanNo(`DC-1(${fy})`);
        }
      }
    };

    initializeForm();
  }, [id, navigate]);

  // Handle client selection from catalog
  const handleClientSelect = (e) => {
    const selectedId = e.target.value;
    setClientId(selectedId);
    if (!selectedId) return;

    const found = clientsList.find((c) => String(c.id) === String(selectedId));
    if (found) {
      setBuyerName(found.name || '');
      setBuyerAddress(found.address || '');
      setBuyerGstin(found.gstin || '');
      setBuyerEmail(found.email || '');
    }
  };

  // Line Item Handlers
  const handleToggleRowMode = (itemId, newMode) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, mode: newMode } : item))
    );
  };

  const handleSelectMaterial = (itemId, materialId) => {
    const matched = materialsCatalog.find((m) => String(m.id) === String(materialId));

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!matched) {
          return {
            ...item,
            selectedMaterialId: '',
            description: '',
            hsn_sac: '8302',
          };
        }
        return {
          ...item,
          selectedMaterialId: materialId,
          description: matched.name,
          hsn_sac: matched.hsn_sac || '8302',
          per: (matched.default_unit || 'NOS').toUpperCase(),
        };
      })
    );
  };

  const handleItemChange = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        mode: 'existing',
        selectedMaterialId: '',
        description: '',
        hsn_sac: '8302',
        quantity: 1,
        per: 'NOS',
        remarks: '',
      },
    ]);
  };

  const handleRemoveItem = (itemId) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  // Save Challan Handler
  const handleSaveChallan = async (andPreview = false) => {
    setValidationError('');
    setSaveError(null);

    if (!buyerName.trim()) {
      setValidationError('Buyer / Consignee Name is required.');
      return;
    }
    if (!challanNo.trim()) {
      setValidationError('Challan Number is required.');
      return;
    }

    const validItems = items.filter(
      (item) => item.description && item.description.trim() && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      setValidationError('Please add at least one line item with description and quantity > 0.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Upsert Client Record
      let resolvedClientId = clientId;
      const clientPayload = {
        name: buyerName.trim(),
        address: buyerAddress,
        gstin: buyerGstin
      };
      if (buyerEmail.trim()) {
        clientPayload.email = buyerEmail.trim();
      }

      let { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .upsert(clientPayload, { onConflict: 'name' })
        .select()
        .single();

      if (clientErr && clientErr.code === '42703') {
        delete clientPayload.email;
        const retryResult = await supabase
          .from('clients')
          .upsert(clientPayload, { onConflict: 'name' })
          .select()
          .single();
        clientData = retryResult.data;
      }

      if (clientData?.id) {
        resolvedClientId = clientData.id;
      }

      // 2. Prepare Delivery Challan Payload
      const challanPayload = {
        challan_no: challanNo.trim(),
        challan_date: challanDate,
        client_id: resolvedClientId || null,
        purpose: purpose,
        status: status,
        vehicle_no: vehicleNo.trim() || null,
        buyer_order_no: buyerOrderNo.trim() || null,
        dispatch_through: dispatchThrough.trim() || 'ROAD',
        destination: destination.trim() || 'COIMBATORE',
      };

      let savedChallanId = id;

      if (id) {
        // UPDATE MODE
        const { error: updateErr } = await supabase
          .from('delivery_challans')
          .update(challanPayload)
          .eq('id', id);

        if (updateErr) throw new Error(updateErr.message || 'Failed to update delivery challan.');

        // Delete previous items and reinsert
        await supabase
          .from('delivery_challan_items')
          .delete()
          .eq('challan_id', id);
      } else {
        // INSERT MODE
        const { data: newChallan, error: insertErr } = await supabase
          .from('delivery_challans')
          .insert(challanPayload)
          .select()
          .single();

        if (insertErr) throw new Error(insertErr.message || 'Failed to create delivery challan.');
        savedChallanId = newChallan.id;
      }

      // 3. Insert Delivery Challan Items
      const itemsPayload = validItems.map((item) => ({
        challan_id: savedChallanId,
        description: item.description.trim(),
        hsn_sac: item.hsn_sac ? item.hsn_sac.trim() : null,
        quantity: parseFloat(item.quantity) || 1,
        per: (item.per || 'NOS').toUpperCase(),
        remarks: item.remarks ? item.remarks.trim() : null,
      }));

      const { error: itemsErr } = await supabase
        .from('delivery_challan_items')
        .insert(itemsPayload);

      if (itemsErr) {
        throw new Error(itemsErr.message || 'Challan created, but failed to save line items.');
      }

      setIsSaved(true);

      if (andPreview) {
        navigate(`/challan/${savedChallanId}`);
      } else {
        setTimeout(() => {
          navigate('/challans');
        }, 1000);
      }
    } catch (err) {
      console.error('Error saving delivery challan:', err);
      setSaveError(err.message || 'Failed to save delivery challan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] flex flex-col items-center justify-center p-6 text-[#36454F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#F2A104] mb-3" />
        <span className="text-xs font-semibold text-[#5C7A99]">Loading Delivery Challan...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F6] flex flex-col font-sans text-[#36454F]">
      <Navbar activeTab="challans" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/challans"
              className="p-2 rounded-xl bg-white border border-slate-200 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#36454F] font-heading">
                  {id ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-[#F2A104] text-[10px] font-bold border border-amber-200 uppercase">
                  Non-Tax Dispatch
                </span>
              </div>
              <p className="text-xs text-[#5C7A99] font-medium">
                For Job Work, returnable material, or advance dispatch before final billing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSaveChallan(false)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#36454F] hover:bg-[#2c3840] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-[#F2A104]" />}
              <span>Save Challan</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveChallan(true)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Save & Preview</span>
            </button>
          </div>
        </div>

        {/* Validation or Error Messages */}
        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{validationError}</span>
            </motion.div>
          )}

          {saveError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </motion.div>
          )}

          {isSaved && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Delivery Challan saved successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Body */}
        <div className="space-y-6">

          {/* SECTION 1: Challan Meta & Dispatch Purpose */}
          <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-[#F2A104]" /> 1. Challan & Dispatch Purpose
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Challan No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  placeholder="e.g. DC-1(2026-27)"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Challan Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={challanDate}
                  onChange={(e) => setChallanDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Purpose of Dispatch <span className="text-rose-500">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
                >
                  <option value="Job Work">Job Work</option>
                  <option value="Returnable">Returnable</option>
                  <option value="Sale on Approval">Sale on Approval</option>
                  <option value="Sample">Sample</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Delivery Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                  <option value="converted">Invoiced</option>
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 2 & 3: Consignee & Dispatch Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Consignee / Buyer Details */}
            <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#F2A104]" /> 2. Consignee / Buyer Details
                </h3>

                {clientsList.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[10px] text-[#5C7A99] font-bold uppercase">Quick Pick:</span>
                    <select
                      value={clientId}
                      onChange={handleClientSelect}
                      className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-[#36454F] focus:outline-none"
                    >
                      <option value="">Select Existing Client...</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Consignee / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter consignee or buyer name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Delivery Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter site / delivery address"
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#36454F] mb-1">
                      GSTIN / UIN
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 33AIRPA0104B1ZN"
                      value={buyerGstin}
                      onChange={(e) => setBuyerGstin(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#36454F] mb-1">
                      Buyer Order No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PO-7718"
                      value={buyerOrderNo}
                      onChange={(e) => setBuyerOrderNo(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Transport & Dispatch Details */}
            <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Truck className="w-4 h-4 text-[#F2A104]" /> 3. Transport & Vehicle Details
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Vehicle Number <span className="text-[#F2A104] font-bold">(Key for Challans)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TN 38 CD 1234 / Temp Reg"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#36454F] mb-1">
                      Dispatched Through
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ROAD / Transport Name"
                      value={dispatchThrough}
                      onChange={(e) => setDispatchThrough(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#36454F] mb-1">
                      Destination
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. COIMBATORE"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-[#36454F] block mb-0.5">GST Rule 55 Delivery Challan:</span>
                  Dispatches without tax are valid for Job Work, goods sent on approval, demonstration, or internal transport.
                </div>
              </div>
            </section>

          </div>

          {/* SECTION 4: Line Items Table (Without Rate, Disc%, Amount) */}
          <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[#F2A104]" /> 4. Dispatched Line Items
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">(Quantity only, no pricing/tax)</span>
              </div>
              <span className="text-[11px] text-[#5C7A99] font-bold">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-center w-12">#</th>
                    <th className="px-4 py-3 min-w-[260px]">Description of Goods</th>
                    <th className="px-3 py-3 w-28 text-center">HSN/SAC</th>
                    <th className="px-3 py-3 w-28 text-center">Quantity</th>
                    <th className="px-3 py-3 w-24 text-center">Per</th>
                    <th className="px-3 py-3 min-w-[160px]">Remarks</th>
                    <th className="px-3 py-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <AnimatePresence initial={false}>
                    {items.map((item, index) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.15 }}
                        className="hover:bg-slate-50/50"
                      >
                        {/* Sl No */}
                        <td className="px-3 py-3 text-center font-bold text-[#5C7A99]">
                          {index + 1}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-2.5">
                          <div className="space-y-1.5">
                            {/* Mode Toggle Switch */}
                            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleToggleRowMode(item.id, 'existing')}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  (item.mode || 'existing') === 'existing'
                                    ? 'bg-[#F2A104] text-[#36454F] shadow-xs'
                                    : 'text-[#5C7A99] hover:text-[#36454F]'
                                }`}
                              >
                                Select Material
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleRowMode(item.id, 'new')}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  item.mode === 'new'
                                    ? 'bg-[#F2A104] text-[#36454F] shadow-xs'
                                    : 'text-[#5C7A99] hover:text-[#36454F]'
                                }`}
                              >
                                Type New
                              </button>
                            </div>

                            {item.mode === 'new' ? (
                              <input
                                type="text"
                                placeholder="Enter goods description..."
                                value={item.description}
                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-[#36454F] focus:ring-1 focus:ring-[#5C7A99] focus:outline-none"
                              />
                            ) : (
                              <select
                                value={item.selectedMaterialId || ''}
                                onChange={(e) => handleSelectMaterial(item.id, e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-[#36454F] focus:ring-1 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
                              >
                                <option value="">Select from Materials Catalog...</option>
                                {materialsCatalog.map((mat) => (
                                  <option key={mat.id} value={mat.id}>
                                    {mat.name} {mat.hsn_sac ? `(${mat.hsn_sac})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* HSN/SAC */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsn_sac}
                            onChange={(e) => handleItemChange(item.id, 'hsn_sac', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-700 focus:ring-1 focus:ring-[#5C7A99] focus:outline-none"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[#36454F] focus:ring-1 focus:ring-[#5C7A99] focus:outline-none"
                          />
                        </td>

                        {/* Per / Unit */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="text"
                            placeholder="Unit"
                            value={item.per}
                            onChange={(e) => handleItemChange(item.id, 'per', e.target.value.toUpperCase())}
                            className="w-full text-center px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-[#5C7A99] focus:ring-1 focus:ring-[#5C7A99] focus:outline-none"
                          />
                        </td>

                        {/* Remarks */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            placeholder="e.g. Returnable, Heat No 44"
                            value={item.remarks}
                            onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-[#5C7A99] focus:outline-none"
                          />
                        </td>

                        {/* Delete Row Action */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length === 1}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              items.length === 1
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-rose-500 hover:bg-rose-50'
                            }`}
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#F2A104]" />
                <span>Add Another Item</span>
              </button>

              <div className="text-xs font-medium text-slate-500">
                Total Quantity:{' '}
                <span className="font-mono font-bold text-[#36454F]">
                  {items.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0)}
                </span>
              </div>
            </div>
          </section>

        </div>

      </main>
    </div>
  );
}
