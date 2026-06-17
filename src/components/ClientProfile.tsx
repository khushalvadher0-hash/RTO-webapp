import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscribeToDocsFor, type CustomerDoc } from "@/lib/customerDocs";
import { subscribeToTasksForRecord } from "@/lib/tasks";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { formatActivityTime, type ActivityLog } from "@/lib/activity";
import { getRecordServices, getRecordServiceDetails, serviceLabel, type RegistryRecord } from "@/lib/records";

interface Props {
  record: RegistryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientProfile({ record, open, onOpenChange }: Props) {
  const [docs, setDocs] = useState<CustomerDoc[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!record) return;
    const unsubDocs = subscribeToDocsFor(record.id, setDocs);
    const unsubTasks = subscribeToTasksForRecord(record.id, setTasks);

    // Subscribe to client_activity_logs collection
    const q = query(collection(db, "client_activity_logs"), where("clientId", "==", record.id), orderBy("timestamp", "desc"));
    const unsubActs = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => d.data() as any);
      setActivities(items.map((it: any) => ({
        id: it.id ?? "",
        actor: it.userName ?? it.userId ?? "",
        action: it.action,
        field: it.field,
        oldValue: it.oldValue,
        newValue: it.newValue,
        timestamp: it.timestamp,
      })));
    });

    return () => {
      unsubDocs();
      unsubTasks();
      unsubActs();
    };
  }, [record]);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Profile — {record.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <section>
            <h4 className="text-sm font-semibold border-b pb-1">Client & Vehicle Details</h4>
            <div className="mt-2 text-sm space-y-1">
              <div><strong>Full Name:</strong> {record.name}</div>
              <div><strong>Mobile Number:</strong> {record.mo}</div>
              <div><strong>Email:</strong> {record.groupName || "—"}</div>
              <div><strong>Address:</strong> {record.co || "—"}</div>
              <div><strong>Vehicle Number:</strong> {record.mvNo || "—"}</div>
              <div><strong>Chassis Number:</strong> {record.chassisNo || "—"}</div>
              <div><strong>Engine Number:</strong> {record.engineNo || "—"}</div>
              <div><strong>Created At:</strong> {record.date}</div>
              <div><strong>Created By:</strong> {record.lastUpdatedBy || "—"}</div>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold border-b pb-1">Service Information</h4>
            <div className="mt-2 space-y-2">
              {getRecordServiceDetails(record).map((service, index) => (
                <div key={index} className="text-sm border p-2 rounded bg-muted/10 flex justify-between items-center">
                  <div>
                    <span className="font-semibold">{serviceLabel(service.serviceType)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({service.status})</span>
                  </div>
                  <div className="text-xs font-mono">
                    Due: {service.dueDate ? new Date(service.dueDate).toLocaleDateString("en-IN") : "—"}
                  </div>
                </div>
              ))}
              {getRecordServiceDetails(record).length === 0 && (
                <div className="text-xs text-muted-foreground">No services recorded.</div>
              )}
            </div>
          </section>

          <section className="md:col-span-2">
            <h4 className="text-sm font-semibold border-b pb-1">Documents</h4>
            <div className="mt-2 space-y-2">
              {docs.length === 0 && <div className="text-xs text-muted-foreground">No documents uploaded.</div>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between border p-2 rounded">
                  <div className="text-sm">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.type} • {(d.fileSize||0)/1024|0} KB • {new Date(d.addedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    {d.downloadURL && <a href={d.downloadURL} target="_blank" rel="noreferrer"><Button size="sm">View</Button></a>}
                    {d.storagePath && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(d.storagePath || ""); }}>Copy Path</Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="md:col-span-2">
            <h4 className="text-sm font-semibold border-b pb-1">Active Tasks</h4>
            <div className="mt-2 space-y-2">
              {tasks.length === 0 && <div className="text-xs text-muted-foreground">No active tasks.</div>}
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between border p-2 rounded text-sm">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.status} • Due: {t.dueDate || '—'}</div>
                  </div>
                  <div className="text-xs">{t.assignee || 'Unassigned'}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="md:col-span-2">
            <h4 className="text-sm font-semibold border-b pb-2 mb-3">Activity Timeline</h4>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {activities.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No activity history yet.</div>}
              {activities.map((a, i) => {
                const timestampDate = new Date(a.timestamp);
                const dateString = timestampDate.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }); // e.g. 15 June 2026
                const timeString = timestampDate.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }); // e.g. 11:42 AM

                return (
                  <div key={i} className="flex gap-4 items-start text-sm">
                    {/* Visual Dot/Line node */}
                    <div className="flex flex-col items-center flex-shrink-0 mt-1">
                      <div className="size-3 rounded-full bg-primary border-2 border-background" />
                      {i < activities.length - 1 && <div className="w-0.5 h-12 bg-muted-foreground/20" />}
                    </div>

                    <div className="flex-1 bg-muted/10 p-3 rounded-lg border hover:border-primary/20 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="font-semibold text-primary">{a.actor}</span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {dateString} at {timeString}
                        </span>
                      </div>
                      <div className="font-medium mt-1 text-card-foreground">{a.action}</div>
                      {a.field && (
                        <div className="mt-2 text-xs grid grid-cols-2 gap-4 bg-muted/20 p-2 rounded border">
                          <div>
                            <span className="text-muted-foreground block uppercase font-bold text-[9px]">Old Value</span>
                            <span className="font-mono text-muted-foreground">{a.oldValue || "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block uppercase font-bold text-[9px]">New Value</span>
                            <span className="font-mono text-green-700 font-semibold">{a.newValue || "—"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientProfile;
