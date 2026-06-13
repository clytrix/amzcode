import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { Plus, Edit2, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  adminGetAllPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminDeletePackage,
} from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/admin/data-entry-packages")({
  component: AdminDataEntryPackages,
});

function AdminDataEntryPackages() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const fetchPackages = useServerFn(adminGetAllPackages);
  const createPackage = useServerFn(adminCreatePackage);
  const updatePackage = useServerFn(adminUpdatePackage);
  const deletePackage = useServerFn(adminDeletePackage);

  const [form, setForm] = useState({
    name: "",
    daily_task_limit: 20,
    price_inr: 1500,
    duration_days: 30,
    reward_per_task: 100,
    is_active: true,
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const result = await fetchPackages({ data: {} });
      setPackages(result.packages);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || form.daily_task_limit < 1 || form.price_inr < 1) {
      toast.error("Please fill all fields correctly");
      return;
    }

    try {
      if (editing) {
        await updatePackage({
          data: {
            id: editing.id,
            name: form.name,
            daily_task_limit: form.daily_task_limit,
            price_inr: form.price_inr,
            duration_days: form.duration_days,
            reward_per_task: form.reward_per_task,
            is_active: form.is_active,
          },
        });
        toast.success("Package updated");
      } else {
        await createPackage({
          data: {
            name: form.name,
            daily_task_limit: form.daily_task_limit,
            price_inr: form.price_inr,
            duration_days: form.duration_days,
            reward_per_task: form.reward_per_task,
          },
        });
        toast.success("Package created");
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      await loadPackages();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save package");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      await deletePackage({ data: { id } });
      toast.success("Package deleted");
      await loadPackages();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete package");
    }
  };

  const handleEdit = (pkg: any) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      daily_task_limit: pkg.daily_task_limit,
      price_inr: pkg.price_inr,
      duration_days: pkg.duration_days,
      reward_per_task: pkg.reward_per_task,
      is_active: pkg.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      name: "",
      daily_task_limit: 20,
      price_inr: 1500,
      duration_days: 30,
      reward_per_task: 100,
      is_active: true,
    });
  };

  const toggleActive = async (pkg: any) => {
    try {
      await updatePackage({
        data: {
          id: pkg.id,
          is_active: !pkg.is_active,
        },
      });
      toast.success(pkg.is_active ? "Package deactivated" : "Package activated");
      await loadPackages();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update package");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Entry Packages</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscription packages for data entry tasks
          </p>
        </div>
        <AzButton
          variant="brand"
          size="sm"
          onClick={() => {
            setShowForm(true);
            setEditing(null);
            resetForm();
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add Package
        </AzButton>
      </div>

      {/* Package Form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-bold mb-4">
            {editing ? "Edit Package" : "Create New Package"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold mb-1">Package Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Starter, Basic, Pro"
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Daily Task Limit</label>
              <input
                type="number"
                value={form.daily_task_limit}
                onChange={(e) => setForm({ ...form, daily_task_limit: parseInt(e.target.value) || 0 })}
                min={1}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Price (₹)</label>
              <input
                type="number"
                value={form.price_inr}
                onChange={(e) => setForm({ ...form, price_inr: parseInt(e.target.value) || 0 })}
                min={1}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Reward per Task (₹)</label>
              <input
                type="number"
                value={form.reward_per_task}
                onChange={(e) => setForm({ ...form, reward_per_task: parseInt(e.target.value) || 0 })}
                min={1}
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Default Duration (days)</label>
              <input
                type="number"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 0 })}
                min={0}
                placeholder="0 = permanent"
                className="w-full rounded border border-input bg-white px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">0 = permanent, 30 = 1 month</p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm font-bold">Active (visible to users)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="rounded border px-4 py-2 text-sm font-bold hover:bg-secondary"
            >
              Cancel
            </button>
            <AzButton variant="brand" size="sm" onClick={handleSubmit}>
              {editing ? "Update Package" : "Create Package"}
            </AzButton>
          </div>
        </div>
      )}

      {/* Packages Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Name</th>
                <th className="px-4 py-3 text-left font-bold">Daily Limit</th>
                <th className="px-4 py-3 text-left font-bold">Price</th>
                <th className="px-4 py-3 text-left font-bold">Reward/Task</th>
                <th className="px-4 py-3 text-left font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{pkg.name}</td>
                  <td className="px-4 py-3">{pkg.daily_task_limit} tasks</td>
                  <td className="px-4 py-3">{inr(pkg.price_inr)}</td>
                  <td className="px-4 py-3">{inr(pkg.reward_per_task)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(pkg)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        pkg.is_active
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {pkg.is_active ? (
                        <><CheckCircle2 className="h-3 w-3" /> Active</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> Inactive</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="p-1 rounded hover:bg-secondary"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No packages yet. Create your first package to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
