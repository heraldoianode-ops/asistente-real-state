'use client';

import { useEffect, useState } from 'react';
import AdminGuard from '@/components/AdminGuard';
import { apiFetch } from '@/lib/api';

interface WANumber {
  id: string;
  agent_id: string;
  phone_number: string;
  phone_number_id: string;
  display_name: string | null;
  is_active: boolean;
  enabled_at: string | null;
  disabled_at: string | null;
}

interface CreateForm {
  agent_id: string;
  phone_number: string;
  phone_number_id: string;
  display_name: string;
}

export default function WhatsAppPage() {
  const [numbers, setNumbers] = useState<WANumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    agent_id: '', phone_number: '', phone_number_id: '', display_name: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadNumbers() {
    setLoading(true);
    try {
      const data = await apiFetch<WANumber[]>('/admin/whatsapp');
      setNumbers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNumbers(); }, []);

  async function handleToggle(n: WANumber) {
    await apiFetch(`/admin/whatsapp/${n.id}/toggle`, { method: 'PATCH' });
    await loadNumbers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await apiFetch('/admin/whatsapp', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({ agent_id: '', phone_number: '', phone_number_id: '', display_name: '' });
      await loadNumbers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Números WhatsApp</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + Registrar número
          </button>
        </div>

        {loading ? (
          <p>Cargando…</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Número</th>
                <th className="p-2">Phone Number ID</th>
                <th className="p-2">Display Name</th>
                <th className="p-2">Agent ID</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id} className="border-t">
                  <td className="p-2">{n.phone_number}</td>
                  <td className="p-2 font-mono text-xs">{n.phone_number_id}</td>
                  <td className="p-2">{n.display_name ?? '-'}</td>
                  <td className="p-2 font-mono text-xs">{n.agent_id}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      n.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {n.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => handleToggle(n)}
                      className="text-xs underline text-blue-600 hover:text-blue-800"
                    >
                      {n.is_active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleCreate}
              className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-3"
            >
              <h2 className="text-lg font-bold">Registrar número WhatsApp</h2>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              {(['agent_id', 'phone_number', 'phone_number_id', 'display_name'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required={field !== 'display_name'}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Registrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
