'use client';

import { useEffect, useState } from 'react';
import AdminGuard from '@/components/AdminGuard';
import { apiFetch } from '@/lib/api';

interface Agent {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  wa_contact_id: string | null;
  created_at: string;
}

interface CreateForm {
  email: string;
  full_name: string;
  password: string;
  wa_contact_id: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>({ email: '', full_name: '', password: '', wa_contact_id: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await apiFetch<Agent[]>('/admin/agents');
      setAgents(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAgents(); }, []);

  async function handleToggle(agent: Agent) {
    await apiFetch(`/admin/agents/${agent.id}/activate`, { method: 'PATCH' });
    await loadAgents();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await apiFetch('/admin/agents', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowModal(false);
      setForm({ email: '', full_name: '', password: '', wa_contact_id: '' });
      await loadAgents();
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
          <h1 className="text-xl font-bold">Agentes</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + Crear agente
          </button>
        </div>

        {loading ? (
          <p>Cargando…</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">Nombre</th>
                <th className="p-2">Email</th>
                <th className="p-2">WA Contact</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.full_name ?? '-'}</td>
                  <td className="p-2">{a.email}</td>
                  <td className="p-2">{a.wa_contact_id ?? '-'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {a.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => handleToggle(a)}
                      className="text-xs underline text-blue-600 hover:text-blue-800"
                    >
                      {a.is_active ? 'Desactivar' : 'Activar'}
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
              <h2 className="text-lg font-bold">Nuevo agente</h2>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              {(['email', 'full_name', 'password', 'wa_contact_id'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field.replace('_', ' ')}
                  </label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required={field !== 'wa_contact_id'}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Crear'}
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
