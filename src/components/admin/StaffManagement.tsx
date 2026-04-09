import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Store as StoreIcon, 
  Shield, 
  Phone, 
  Mail, 
  MapPin, 
  User as UserIcon,
  ChevronRight,
  Loader2,
  Save,
  X,
  ShieldCheck,
  Activity,
  History,
  Briefcase,
  Lock,
  Unlock,
  Users as UsersIcon,
  Package as PackageIcon,
  Truck,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  getDocs,
  serverTimestamp,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { User, Store, AdminRole } from '../../types';
import { format } from 'date-fns';
import ConfirmModal from '../ConfirmModal';

interface StaffManagementProps {
  stores: Store[];
}

const StaffManagement: React.FC<StaffManagementProps> = ({ stores }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    staffId: '',
    adminRole: 'store_staff' as AdminRole,
    storeId: '',
    address: '',
    status: 'active' as 'active' | 'inactive',
    password: '' // For new staff
  });

  // Role Permissions state
  const [rolePermissions, setRolePermissions] = useState<any>({});
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  useEffect(() => {
    // Fetch all staff (users with adminRole)
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsub = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as User[];
      setStaff(staffData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    // Fetch role permissions
    const unsubPermissions = onSnapshot(collection(db, 'role_permissions'), (snapshot) => {
      const permissions: any = {};
      snapshot.docs.forEach(doc => {
        permissions[doc.id] = doc.data();
      });
      setRolePermissions(permissions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'role_permissions');
    });

    return () => {
      unsub();
      unsubPermissions();
    };
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeId) {
      alert('Please assign a store first');
      return;
    }
    
    setIsCreating(true);
    try {
      const staffData = {
        ...formData,
        role: formData.adminRole === 'store_manager' ? 'manager' : 'staff',
        adminRole: formData.adminRole,
        userType: 'admin',
        isRegistered: true,
      };
      // @ts-ignore
      delete staffData.password;

      const response = await fetch('/api/auth/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffData, password: formData.password })
      });
      
      const result = await response.json();
      if (result.success) {
        setIsAddModalOpen(false);
        resetForm();
      } else {
        alert(result.error || 'Failed to create staff');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during staff creation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      const { password, ...updateData } = formData;
      await updateDoc(doc(db, 'users', selectedStaff.uid), updateData);
      setIsEditModalOpen(false);
      setSelectedStaff(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedStaff.uid}`);
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    setConfirmConfig({
      title: 'Remove Staff Member',
      message: 'Are you sure you want to remove this staff member? This will delete their user account from Firebase Authentication and their data from Firestore.',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/auth/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid })
          });
          
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete staff member');
          }
        } catch (error: any) {
          console.error('Error deleting staff:', error);
          alert(`Error: ${error.message}`);
        }
      },
      variant: 'danger'
    });
    setIsConfirmModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      staffId: '',
      adminRole: 'store_staff',
      storeId: '',
      address: '',
      status: 'active',
      password: ''
    });
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.adminRole === roleFilter;
    const matchesStore = storeFilter === 'all' || s.storeId === storeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesRole && matchesStore && matchesStatus;
  });

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'store_manager': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'store_staff': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'delivery_staff': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const handleTogglePermission = async (role: string, permission: string) => {
    const current = rolePermissions[role] || {};
    const updated = { ...current, [permission]: !current[permission] };
    try {
      await updateDoc(doc(db, 'role_permissions', role), updated);
    } catch (error) {
      // If it doesn't exist, create it
      try {
        await setDoc(doc(db, 'role_permissions', role), updated);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'role_permissions');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search staff by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsRoleModalOpen(true)}
            className="px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Role Permissions
          </button>
          <button 
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Staff
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
          <Filter className="w-4 h-4 text-gray-400" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none text-gray-600 dark:text-gray-400"
          >
            <option value="all">All Roles</option>
            <option value="store_manager">Managers</option>
            <option value="store_staff">Staff</option>
            <option value="delivery_staff">Delivery</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
          <StoreIcon className="w-4 h-4 text-gray-400" />
          <select 
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none text-gray-600 dark:text-gray-400"
          >
            <option value="all">All Stores</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
          <Activity className="w-4 h-4 text-gray-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none text-gray-600 dark:text-gray-400"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name & ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Store</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-sm font-bold text-gray-400">Loading staff data...</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <UsersIcon className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                    <p className="text-lg font-black text-gray-800 dark:text-gray-200">No staff found</p>
                    <p className="text-sm text-gray-500">Try adjusting your filters or search term.</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-black text-xs">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100">{s.name}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.staffId || s.employeeId || 'NO ID'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getRoleBadge(s.adminRole)}`}>
                        {s.adminRole?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                        <StoreIcon className="w-4 h-4" />
                        {stores.find(st => st.id === s.storeId)?.name || 'Unassigned'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                          <Mail className="w-3 h-3" />
                          {s.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                          <Phone className="w-3 h-3" />
                          {s.phone || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${s.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                        {s.status === 'active' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {s.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => { setSelectedStaff(s); setIsProfileModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { 
                            setSelectedStaff(s); 
                            setFormData({
                              name: s.name,
                              email: s.email,
                              phone: s.phone || '',
                              staffId: s.staffId || '',
                              adminRole: s.adminRole || 'store_staff',
                              storeId: s.storeId || '',
                              address: s.address || '',
                              status: s.status || 'active',
                              password: ''
                            });
                            setIsEditModalOpen(true); 
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStaff(s.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                  {isAddModalOpen ? 'Add New Staff' : 'Edit Staff Member'}
                </h3>
                <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={isAddModalOpen ? handleAddStaff : handleUpdateStaff} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Staff ID Code</label>
                    <input 
                      required
                      type="text"
                      value={formData.staffId}
                      onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                      placeholder="e.g. ST-WW-001"
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Role</label>
                    <select 
                      value={formData.adminRole}
                      onChange={(e) => setFormData({ ...formData, adminRole: e.target.value as AdminRole })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="store_manager">Store Manager</option>
                      <option value="store_staff">Store Staff</option>
                      <option value="delivery_staff">Delivery Staff</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Assign Store</label>
                    <select 
                      required
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a store</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Address</label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                  />
                </div>
                {isAddModalOpen && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                    <input 
                      required
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter initial password"
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isAddModalOpen ? 'Create Staff' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile View Modal */}
      <AnimatePresence>
        {isProfileModalOpen && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="relative h-32 bg-blue-600">
                <button onClick={() => setIsProfileModalOpen(false)} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="px-8 pb-8">
                <div className="relative -mt-12 flex items-end gap-6 mb-8">
                  <div className="w-24 h-24 rounded-[2rem] bg-white dark:bg-gray-900 p-1 shadow-xl">
                    <div className="w-full h-full rounded-[1.8rem] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-black text-3xl">
                      {selectedStaff.name.charAt(0)}
                    </div>
                  </div>
                  <div className="pb-2">
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">{selectedStaff.name}</h3>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedStaff.staffId || selectedStaff.employeeId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          {selectedStaff.adminRole?.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Store</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <StoreIcon className="w-4 h-4 text-blue-500" />
                          {stores.find(s => s.id === selectedStaff.storeId)?.name || 'Unassigned'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-500" />
                          {selectedStaff.email}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-500" />
                          {selectedStaff.phone || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Activity Log
                      </h4>
                      <div className="space-y-3">
                        {[
                          { action: 'Updated order #1234', time: '2 hours ago', icon: PackageIcon },
                          { action: 'Logged in', time: '5 hours ago', icon: Lock },
                          { action: 'Assigned task to delivery', time: 'Yesterday', icon: Truck },
                        ].map((log, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="p-2 bg-white dark:bg-gray-900 rounded-lg">
                              <log.icon className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{log.action}</p>
                              <p className="text-[10px] font-bold text-gray-400">{log.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border border-blue-100 dark:border-blue-800/30">
                      <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Performance</h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">48</p>
                            <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Orders Handled</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-blue-600/20" />
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">4.9</p>
                            <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Rating</p>
                          </div>
                          <CheckCircle2 className="w-8 h-8 text-blue-600/20" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Address</p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {selectedStaff.address || 'No address provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Role Permissions Modal */}
      <AnimatePresence>
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Role Permissions</h3>
                <button onClick={() => setIsRoleModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Permission</th>
                      <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Store Manager</th>
                      <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Store Staff</th>
                      <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Delivery Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {[
                      { id: 'view_orders', label: 'View Orders' },
                      { id: 'update_status', label: 'Update Status' },
                      { id: 'assign_tasks', label: 'Assign Tasks' },
                      { id: 'access_logistics', label: 'Access Logistics' },
                      { id: 'manage_inventory', label: 'Manage Inventory' },
                      { id: 'view_reports', label: 'View Reports' },
                    ].map((perm) => (
                      <tr key={perm.id}>
                        <td className="px-4 py-4 font-bold text-gray-700 dark:text-gray-300">{perm.label}</td>
                        {['store_manager', 'store_staff', 'delivery_staff'].map((role) => (
                          <td key={role} className="px-4 py-4 text-center">
                            <button 
                              onClick={() => handleTogglePermission(role, perm.id)}
                              className={`p-2 rounded-lg transition-all ${rolePermissions[role]?.[perm.id] ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-300 hover:text-gray-400'}`}
                            >
                              {rolePermissions[role]?.[perm.id] ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <button 
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
      />
    </div>
  );
};

export default StaffManagement;
