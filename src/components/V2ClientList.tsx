import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, Eye, Pencil, Users, Download, FileText, ChevronDown, ChevronRight, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CLIENTS_COL,
  type Client,
  type Vehicle,
  subscribeToClients,
  subscribeAllVehicles,
  saveClient,
  deleteClient,
} from "@/lib/hierarchy";
import { secureDelete } from "@/lib/secureDelete";
import { subscribeStaffPermissions, type RolePermissions } from "@/lib/permissions";
import { ClientDetailWorkspace } from "./ClientDetailWorkspace";
import { generatePDF } from "@/lib/pdfGenerator";
import { toast } from "sonner";
import { getSession } from "@/lib/auth";
import { collection } from "firebase/firestore";

interface V2ClientListProps {
  type: "client" | "lead";
  title: string;
  description: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-yellow-100 text-yellow-800",
    "bg-teal-100 text-teal-700",
    "bg-red-100 text-red-700",
  ];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

export function V2ClientList({ type, title, description }: V2ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const collectionPath = "registry_clients_v2";

  // Client Details modal state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Add/Edit Client form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState<Partial<Client>>({});
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);

  const session = getSession();
  const isAdmin = session?.role === "admin";

  useEffect(() => {
    const unsubPerms = subscribeStaffPermissions((p) => {
      setRolePermissions(p);
    });
    return () => {
      unsubPerms();
    };
  }, []);

  const isManager = session?.role === "manager";
  const isEmployee = session?.role === "employee";
  const canCreate = isAdmin || isManager || (rolePermissions?.createClients ?? false);
  const canEdit = isAdmin || isManager || (rolePermissions?.editClients ?? false);
  const canDelete = (isAdmin || isManager) && !isEmployee;

  useEffect(() => {
    setLoading(true);

    const unsub = subscribeToClients(type, (data) => {
      console.log("Clients Query Result", data);
      console.log("Collection Path", collectionPath);
      console.log("Documents Count", data.length);
      
      const filtered = isEmployee
        ? data.filter((c: any) => c.assignee === session?.username)
        : data;

      setClients(filtered);
      setLoading(false);
    });
    return unsub;
  }, [type]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return subscribeAllVehicles(setVehicles);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase().trim();
    return clients.filter((c) => {
      const clientVehicles = vehicles.filter((v) => v.clientId === c.id);
      return (
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.companyName || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        clientVehicles.some((v) => v.vehicleNumber.toLowerCase().includes(q))
      );
    });
  }, [clients, vehicles, query]);

  const handleOpenAddForm = () => {
    if (!canCreate) {
      toast.error("You do not have permission to create clients");
      return;
    }
    setEditingClient(null);
    setClientForm({
      id: `client_${crypto.randomUUID()}`,
      name: "",
      mobile: "",
      address: "",
      companyName: "",
      notes: "",
      type,
    });
    setFormOpen(true);
  };

  const handleSaveClient = async () => {
    if (editingClient && !canEdit) {
      toast.error("You do not have permission to edit clients");
      return;
    }
    if (!editingClient && !canCreate) {
      toast.error("You do not have permission to create clients");
      return;
    }
    if (!clientForm.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!clientForm.mobile?.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    try {
      const actorOverride = session
        ? { name: session.name, uid: session.uid, role: session.role }
        : undefined;
      await saveClient(clientForm as Client, actorOverride);
      setFormOpen(false);
      toast.success(editingClient ? "Client updated!" : "Client created successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save client.");
    }
  };

  const handleDeleteClient = async (cId: string) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete clients");
      return;
    }
    if (!confirm("Are you sure you want to delete this client?")) {
      return;
    }
    try {
      await secureDelete(
        () => deleteClient(cId),
        "Client",
        cId,
        session?.uid ?? "unknown"
      );
      // secureDelete handles toast messages
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete client.");
    }
  };

  const handleOpenDetails = (id: string) => {
    setSelectedClientId(id);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleOpenAddForm}>
            <Plus className="size-4 mr-1" />
            Add {type === "client" ? "Client" : "Lead"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search by name, mobile, vehicle no, company...`}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {!loading && (
        <div className="px-4 py-2 text-sm text-muted-foreground">
          <div>Collection Path: {collectionPath}</div>
          <div>Documents Count: {clients.length}</div>
        </div>
      )}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-[auto_2fr_2fr_2fr_1fr_auto] gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground items-center">
          <div className="w-6"></div>
          <div>Name</div>
          <div>Contact</div>
          <div>Company Name</div>
          <div>Notes Summary</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            Loading data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            No records found.
          </div>
        ) : (
          filtered.map((c) => {
            const clientVehicles = vehicles.filter((v) => v.clientId === c.id);
            const q = query.toLowerCase().trim();
            const isVehicleSearchMatch =
              q.length > 0 && clientVehicles.some((v) => v.vehicleNumber.toLowerCase().includes(q));
            const isExpanded = expandedClients[c.id] ?? isVehicleSearchMatch;

            return (
              <div key={c.id} className="border-b last:border-0">
                <div className="grid grid-cols-[auto_2fr_2fr_2fr_1fr_auto] gap-4 items-center px-4 py-3 hover:bg-muted/20 transition-colors">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedClients((prev) => ({ ...prev, [c.id]: !isExpanded }));
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                    title={isExpanded ? "Collapse Vehicle Details" : "Expand Vehicle Details"}
                  >
                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>

                  {/* Name */}
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => handleOpenDetails(c.id)}
                  >
                    <div
                      className={cn(
                        "size-9 rounded-full grid place-items-center text-sm font-bold flex-shrink-0",
                        avatarColor(c.name),
                      )}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate text-sky-600 underline decoration-dotted underline-offset-2">
                        {c.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.address || "No address"}
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{c.mobile}</div>
                  </div>

                  <div className="min-w-0 text-xs">
                    <div className="font-medium text-foreground">{c.companyName || "—"}</div>
                  </div>

                  {/* Notes */}
                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                    {c.notes || "—"}
                  </div>

                  {/* Actions */}
                  <div className="text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        generatePDF(
                          "client-details",
                          {
                            name: c.name,
                            mo: c.mobile,
                            email: "",
                            address: c.address || "",
                            group: "",
                            createdAt: "",
                            createdBy: "",
                            vehicles: [],
                          },
                          session?.username || "system",
                        )
                      }
                      title="Download PDF"
                    >
                      <Download className="size-4 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetails(c.id)}
                      title="View workspace"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingClient(c);
                        setClientForm(c);
                        setFormOpen(true);
                      }}
                      disabled={!canEdit}
                      title={!canEdit ? "You do not have permission to edit clients" : "Edit client"}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClient(c.id)}
                      disabled={!canDelete}
                      className="text-destructive hover:bg-destructive/10"
                      title={!canDelete ? "You do not have permission to delete clients" : "Delete client"}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Auto-expanded Vehicle Details Table */}
                {isExpanded && (
                  <div className="px-6 py-3.5 bg-slate-50/70 border-t">
                    <div className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Car className="size-3.5 text-slate-500" /> Vehicle Assets ({clientVehicles.length})
                      </span>
                    </div>
                    {clientVehicles.length > 0 ? (
                      <div className="rounded-lg border bg-white overflow-hidden shadow-xs">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 uppercase tracking-wider text-slate-500 text-[10px] font-semibold border-b">
                            <tr>
                              <th className="text-left px-3 py-2">Vehicle Number</th>
                              <th className="text-left px-3 py-2">Vehicle Type</th>
                              <th className="text-left px-3 py-2">Chassis Number</th>
                              <th className="text-left px-3 py-2">Engine Number</th>
                              <th className="text-left px-3 py-2">Reg Date</th>
                              <th className="text-left px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-slate-700">
                            {clientVehicles.map((v) => (
                              <tr key={v.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-mono font-bold text-sky-700">{v.vehicleNumber}</td>
                                <td className="px-3 py-2 font-medium">{v.vehicleType || "—"}</td>
                                <td className="px-3 py-2 font-mono text-[11px]">{v.chassisNumber || "—"}</td>
                                <td className="px-3 py-2 font-mono text-[11px]">{v.engineNumber || "—"}</td>
                                <td className="px-3 py-2 font-mono">{v.registrationDate ? new Date(v.registrationDate).toLocaleDateString("en-IN") : "—"}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border text-slate-700">
                                    {v.status || "Active"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic py-1">No registered vehicles found for this client.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Client Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClient
                ? "Edit Client Profile"
                : `Add New ${type === "client" ? "Client" : "Lead"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase">Client Name</Label>
              <Input
                value={clientForm.name || ""}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase">Mobile Number</Label>
              <Input
                value={clientForm.mobile || ""}
                onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                placeholder="Mobile"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase">Company Name</Label>
              <Input
                value={clientForm.companyName || ""}
                onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })}
                placeholder="Company / Group"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase">C/O Address</Label>
              <Textarea
                value={clientForm.address || ""}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                placeholder="Address"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase">Notes</Label>
              <Textarea
                value={clientForm.notes || ""}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                placeholder="Internal notes..."
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClient}>{editingClient ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client detail workspace modal */}
      {selectedClientId && (
        <ClientDetailWorkspace
          clientId={selectedClientId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}
