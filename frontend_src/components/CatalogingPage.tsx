import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  BookMarked,
  Tag,
  Hash,
  Calendar,
  User,
  Library,
  X,
  ChevronLeft,
  ChevronRight,
  BookCopy,
  FileText,
} from 'lucide-react';
import {
  getCatalogRecords,
  createCatalogRecord,
  updateCatalogRecord,
  deleteCatalogRecord,
  getCatalogStats,
  CatalogRecord,
} from '../utils/api';

const MATERIAL_TYPES = ['book', 'journal', 'thesis', 'reference', 'multimedia', 'other'];
const STATUSES = ['cataloged', 'pending', 'in_process', 'withdrawn'];

export function CatalogingPage() {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CatalogRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<CatalogRecord | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<CatalogRecord>>({
    title: '',
    author: '',
    author_type: 'personal',
    material_type: 'book',
    language: 'English',
    status: 'cataloged',
    copies_total: 1,
    copies_available: 1,
  });

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [page, filterMaterial, filterStatus]);

  useEffect(() => {
    if (searchTerm === '') {
      loadRecords();
    }
  }, [searchTerm]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    const result = await getCatalogRecords({
      search: searchTerm || undefined,
      material_type: filterMaterial || undefined,
      status: filterStatus || undefined,
      page,
      limit: 20,
    });
    if (result.success) {
      setRecords(result.data || []);
      setTotalPages(result.pagination?.pages || 1);
      setTotalRecords(result.pagination?.total || 0);
    } else {
      setError(result.error || 'Failed to load catalog records');
    }
    setLoading(false);
  };

  const loadStats = async () => {
    setError(null);
    const result = await getCatalogStats();
    if (result.success) setStats(result.data);
    else if (result.error) setError(result.error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = editingRecord?.id
        ? await updateCatalogRecord(editingRecord.id, formData)
        : await createCatalogRecord(formData);

      if (result.success) {
        setShowForm(false);
        setEditingRecord(null);
        resetForm();
        loadRecords();
        loadStats();
      } else {
        alert(result.error || 'Operation failed');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };

  const handleEdit = (record: CatalogRecord) => {
    setEditingRecord(record);
    setFormData(record);
    setShowForm(true);
    setViewingRecord(null);
  };

  const handleView = (record: CatalogRecord) => {
    setViewingRecord(record);
    setShowForm(false);
    setEditingRecord(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this catalog record? This action cannot be undone.')) return;
    const result = await deleteCatalogRecord(id);
    if (result.success) {
      loadRecords();
      loadStats();
      if (viewingRecord?.id === id) setViewingRecord(null);
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      author: '',
      author_type: 'personal',
      material_type: 'book',
      language: 'English',
      status: 'cataloged',
      copies_total: 1,
      copies_available: 1,
    });
  };

  const openNewRecord = () => {
    resetForm();
    setEditingRecord(null);
    setViewingRecord(null);
    setShowForm(true);
  };

  const section = (title: string, color: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div className={`bg-gray-50 rounded-lg p-4 border-l-4 ${color}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookMarked className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Standard Cataloging</h1>
                <p className="text-sm text-gray-500">University Library Catalog Management System</p>
              </div>
            </div>
            <button
              onClick={openNewRecord}
              className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>New Catalog Record</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Catalog Records</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview?.total_records || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Copies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview?.total_copies || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <BookCopy className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Available Copies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview?.available_copies || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-100">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unique Authors</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview?.unique_authors || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-100">
                  <User className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Cataloging Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, author, subject, or keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadRecords()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">All Material Types</option>
              {MATERIAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={loadRecords}
              className="flex items-center space-x-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading catalog records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No catalog records found</p>
              <button onClick={openNewRecord} className="mt-4 text-yellow-600 hover:text-yellow-700 font-medium">
                Create your first catalog record
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Copies</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{record.title}</div>
                          {record.edition && <div className="text-sm text-gray-500">{record.edition}</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{record.author}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {record.local_call_number || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {record.material_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              record.status === 'cataloged'
                                ? 'bg-green-100 text-green-800'
                                : record.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : record.status === 'in_process'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {record.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {record.copies_available}/{record.copies_total}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <button onClick={() => handleView(record)} className="text-blue-600 hover:text-blue-800" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleEdit(record)} className="text-yellow-600 hover:text-yellow-800" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(record.id!)} className="text-red-600 hover:text-red-800" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t">
                  <div className="text-sm text-gray-700">
                    Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalRecords)} of {totalRecords} records
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 border rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingRecord ? 'Edit Catalog Record' : 'New Catalog Record'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingRecord(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">
                {section(
                  <span className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-yellow-500" />
                    <span>Basic Information</span>
                  </span>,
                  'border-yellow-500',
                  null,
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Title *</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Enter full title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Author *</label>
                      <input
                        type="text"
                        required
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Primary author"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Author Type</label>
                      <select
                        value={formData.author_type}
                        onChange={(e) => setFormData({ ...formData, author_type: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      >
                        <option value="personal">Personal Author</option>
                        <option value="corporate">Corporate Author</option>
                        <option value="conference">Conference/Meeting</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Added Author</label>
                      <input
                        type="text"
                        value={formData.added_author}
                        onChange={(e) => setFormData({ ...formData, added_author: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Additional author"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Editor</label>
                      <input
                        type="text"
                        value={formData.editor}
                        onChange={(e) => setFormData({ ...formData, editor: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Editor name"
                      />
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <Library className="w-5 h-5 text-blue-500" />
                    <span>Publication Information</span>
                  </span>,
                  'border-blue-500',
                  null,
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Publisher</label>
                      <input
                        type="text"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Publishing company"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Place of Publication</label>
                      <input
                        type="text"
                        value={formData.publication_place}
                        onChange={(e) => setFormData({ ...formData, publication_place: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="City, Country"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Publication Date</label>
                      <input
                        type="date"
                        value={formData.publication_date}
                        onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Edition</label>
                      <input
                        type="text"
                        value={formData.edition}
                        onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., 2nd ed., Revised"
                      />
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <BookCopy className="w-5 h-5 text-purple-500" />
                    <span>Physical Description & Series</span>
                  </span>,
                  'border-purple-500',
                  null,
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pages</label>
                      <input
                        type="text"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., xvi, 345 p."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Illustrations</label>
                      <input
                        type="text"
                        value={formData.illustrations}
                        onChange={(e) => setFormData({ ...formData, illustrations: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., color illustrations"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dimensions</label>
                      <input
                        type="text"
                        value={formData.dimensions}
                        onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., 24 cm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Series Title</label>
                      <input
                        type="text"
                        value={formData.series_title}
                        onChange={(e) => setFormData({ ...formData, series_title: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Series name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Series Volume</label>
                      <input
                        type="text"
                        value={formData.series_volume}
                        onChange={(e) => setFormData({ ...formData, series_volume: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Volume number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Series Issue</label>
                      <input
                        type="text"
                        value={formData.series_issue}
                        onChange={(e) => setFormData({ ...formData, series_issue: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Issue number"
                      />
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <Hash className="w-5 h-5 text-green-500" />
                    <span>Identifiers & Classification</span>
                  </span>,
                  'border-green-500',
                  null,
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ISBN</label>
                      <input
                        type="text"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="978-3-16-148410-0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ISSN</label>
                      <input
                        type="text"
                        value={formData.issn}
                        onChange={(e) => setFormData({ ...formData, issn: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Journal ISSN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">OCLC Number</label>
                      <input
                        type="text"
                        value={formData.oclc_number}
                        onChange={(e) => setFormData({ ...formData, oclc_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="OCLC control number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Local Call Number</label>
                      <input
                        type="text"
                        value={formData.local_call_number}
                        onChange={(e) => setFormData({ ...formData, local_call_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., QA76.73.C153 C643 2024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Accession Number</label>
                      <input
                        type="text"
                        value={formData.accession_number}
                        onChange={(e) => setFormData({ ...formData, accession_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Unique accession number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dewey Decimal Classification</label>
                      <input
                        type="text"
                        value={formData.dewey_decimal}
                        onChange={(e) => setFormData({ ...formData, dewey_decimal: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., 005.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Library of Congress Classification</label>
                      <input
                        type="text"
                        value={formData.library_of_congress}
                        onChange={(e) => setFormData({ ...formData, library_of_congress: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., QA76.73.C153"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Material Type</label>
                      <select
                        value={formData.material_type}
                        onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      >
                        {MATERIAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <Tag className="w-5 h-5 text-pink-500" />
                    <span>Subject Analysis</span>
                  </span>,
                  'border-pink-500',
                  null,
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject Headings</label>
                      <textarea
                        rows={2}
                        value={formData.subject_headings}
                        onChange={(e) => setFormData({ ...formData, subject_headings: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Library of Congress Subject Headings (separate with semicolons)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Keywords</label>
                      <input
                        type="text"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Comma-separated keywords for search"
                      />
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-orange-500" />
                    <span>Notes & Summary</span>
                  </span>,
                  'border-orange-500',
                  null,
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Summary/Abstract</label>
                      <textarea
                        rows={3}
                        value={formData.summary}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Brief description or abstract of the work"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">General Notes</label>
                      <textarea
                        rows={2}
                        value={formData.general_notes}
                        onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Any additional cataloging notes"
                      />
                    </div>
                  </div>
                )}

                {section(
                  <span className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-teal-500" />
                    <span>Cataloging Metadata & Inventory</span>
                  </span>,
                  'border-teal-500',
                  null,
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Language</label>
                      <input
                        type="text"
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., English, Filipino"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Copies</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.copies_total}
                        onChange={(e) => setFormData({ ...formData, copies_total: parseInt(e.target.value) || 0 })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Available Copies</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.copies_available}
                        onChange={(e) => setFormData({ ...formData, copies_available: parseInt(e.target.value) || 0 })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cataloging Source</label>
                      <input
                        type="text"
                        value={formData.cataloging_source}
                        onChange={(e) => setFormData({ ...formData, cataloging_source: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="e.g., UST-Legazpi Library"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cataloger</label>
                      <input
                        type="text"
                        value={formData.cataloger}
                        onChange={(e) => setFormData({ ...formData, cataloger: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        placeholder="Librarian name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cataloging Date</label>
                      <input
                        type="date"
                        value={formData.cataloging_date}
                        onChange={(e) => setFormData({ ...formData, cataloging_date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                )}
              </form>

              <div className="px-6 py-4 border-t bg-white flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRecord(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg font-medium transition-colors"
                >
                  {editingRecord ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewingRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Catalog Record Details</h2>
                  <button onClick={() => setViewingRecord(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Title</h3>
                      <p className="text-lg font-semibold text-gray-900">{viewingRecord.title}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Author</h3>
                      <p className="text-lg text-gray-900">{viewingRecord.author}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Publisher</h3>
                      <p className="text-gray-900">{viewingRecord.publisher || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Publication Date</h3>
                      <p className="text-gray-900">{viewingRecord.publication_date || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">ISBN</h3>
                      <p className="text-gray-900 font-mono">{viewingRecord.isbn || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Local Call Number</h3>
                      <p className="text-gray-900 font-mono">{viewingRecord.local_call_number || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Dewey Decimal</h3>
                      <p className="text-gray-900 font-mono">{viewingRecord.dewey_decimal || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Material Type</h3>
                      <p className="text-gray-900 capitalize">{viewingRecord.material_type || '—'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Status</h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          viewingRecord.status === 'cataloged'
                            ? 'bg-green-100 text-green-800'
                            : viewingRecord.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : viewingRecord.status === 'in_process'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {viewingRecord.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Copies</h3>
                      <p className="text-gray-900">
                        {viewingRecord.copies_available} / {viewingRecord.copies_total} available
                      </p>
                    </div>
                  </div>

                  {viewingRecord.subject_headings && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Subject Headings</h3>
                      <p className="text-gray-900">{viewingRecord.subject_headings}</p>
                    </div>
                  )}

                  {viewingRecord.summary && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Summary</h3>
                      <p className="text-gray-900">{viewingRecord.summary}</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6 border-t">
                    <button
                      onClick={() => {
                        setViewingRecord(null);
                        handleEdit(viewingRecord);
                      }}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg font-medium transition-colors"
                    >
                      Edit Record
                    </button>
                    <button
                      onClick={() => setViewingRecord(null)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
