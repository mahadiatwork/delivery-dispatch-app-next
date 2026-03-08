import { Order } from "@/types/order";
import { useOrderStore } from "@/store/orderStore";
import { useAssignOrderToDriver, useUpdateOrder } from "@/hooks/useOrders";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "./OrderTimeline";
import {
  Package,
  MapPin,
  Clock,
  FileText,
  Tag,
  User,
  History,
  Truck,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideDriverAssign?: boolean;
}

const orderTypeStyles: Record<string, string> = {
  DODD: "bg-primary/10 text-primary border-primary/20",
  JOBBER: "bg-accent/10 text-accent border-accent/20",
  HOTSHOT: "bg-destructive/10 text-destructive border-destructive/20",
  PICKUP: "bg-status-pickup/10 text-status-pickup border-status-pickup/20",
};

const stageLabels: Record<string, string> = {
  picking: "Picking",
  unassigned_driver: "Unassigned",
  assigned_driver: "Assigned",
  pickup_store: "Pickup",
  completed: "Completed",
};

export function OrderDetailSheet({ order, open, onOpenChange, hideDriverAssign }: OrderDetailSheetProps) {
  const { drivers, assignOrderToDriver } = useOrderStore();
  const assignOrderMutation = useAssignOrderToDriver();
  const updateOrderMutation = useUpdateOrder();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Order> | null>(null);

  // Initialize edit form when order changes or edit mode starts
  const startEditing = () => {
    if (order) {
      const deepCopy = JSON.parse(JSON.stringify(order));
      // Fix dates that were converted to strings
      if (deepCopy.scheduledDate) deepCopy.scheduledDate = new Date(deepCopy.scheduledDate);
      if (deepCopy.createdAt) deepCopy.createdAt = new Date(deepCopy.createdAt);
      if (deepCopy.completedAt) deepCopy.completedAt = new Date(deepCopy.completedAt);

      setEditForm(deepCopy);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleSave = () => {
    if (!order || !editForm) return;

    updateOrderMutation.mutate(
      { id: order.id, updates: editForm },
      {
        onSuccess: () => {
          toast.success("Order updated successfully");
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Failed to update order");
        },
      }
    );
  };

  const handleItemChange = (index: number, field: keyof any, value: any) => {
    if (!editForm || !editForm.items) return;
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditForm({ ...editForm, items: newItems });
  };

  if (!order) return null;

  const handleDriverAssign = (driverId: string) => {
    if (!order) return;

    // Optimistic update - this always works locally
    assignOrderToDriver(order.id, driverId);

    const driver = drivers.find(d => d.id === driverId);

    // Check if this is a local-only driver (starts with 'driver-')
    if (driverId.startsWith('driver-')) {
      // Local-only driver - just show success, don't persist to database
      toast.success(`Order assigned to ${driver?.name || 'driver'} (local)`);
      return;
    }

    // Persist to database for real database drivers
    assignOrderMutation.mutate(
      { orderId: order.id, driverId },
      {
        onSuccess: () => {
          toast.success(`Order assigned to ${driver?.name || 'driver'}`);
        },
        onError: () => {
          toast.error('Failed to assign driver');
        }
      }
    );
  };

  const assignedDriver = drivers.find(d => d.id === order.assignedDriverId);

  return (
    <Sheet open={open} onOpenChange={(v) => {
      if (!v) setIsEditing(false);
      onOpenChange(v);
    }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-lg">{order.customer.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">#{order.customer.id}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  Edit
                </Button>
              )}
              <Badge
                variant="outline"
                className={cn("font-medium", orderTypeStyles[order.orderType])}
              >
                {order.orderType}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="details" className="gap-1.5">
              <Package className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <History className="w-4 h-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            {isEditing && editForm ? (
              // EDIT MODE
              <div className="space-y-4">
                {/* Address */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-2.5" />
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={editForm.customer?.address || ""}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        customer: { ...editForm.customer!, address: e.target.value }
                      })}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.customer?.phone || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      customer: { ...editForm.customer!, phone: e.target.value }
                    })}
                  />
                </div>

                {/* Order Type & RSM */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Order Type</label>
                    <Select
                      value={editForm.orderType}
                      onValueChange={(val: any) => setEditForm({ ...editForm, orderType: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DODD">DODD</SelectItem>
                        <SelectItem value="JOBBER">JOBBER</SelectItem>
                        <SelectItem value="HOTSHOT">HOTSHOT</SelectItem>
                        <SelectItem value="RESTOCK">RESTOCK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">RSM</label>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={editForm.rsm || ""}
                      onChange={(e) => setEditForm({ ...editForm, rsm: e.target.value })}
                    />
                  </div>
                </div>

                {/* Presell (if Jobber) */}
                {editForm.orderType === "JOBBER" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pre-Sell Number</label>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={editForm.presellNumber || ""}
                      onChange={(e) => setEditForm({ ...editForm, presellNumber: e.target.value })}
                    />
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Comments</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.comments || ""}
                    onChange={(e) => setEditForm({ ...editForm, comments: e.target.value })}
                  />
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Items</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setEditForm({
                        ...editForm,
                        items: [...(editForm.items || []), { partNumber: "", quantity: 1, poNumber: "" }]
                      })}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-2 border rounded-md p-2">
                    {editForm.items?.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={item.partNumber}
                          placeholder="Part #"
                          onChange={(e) => handleItemChange(idx, "partNumber", e.target.value)}
                        />
                        <input
                          type="number"
                          className="flex h-8 w-20 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value) || 0)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10 shrink-0"
                          onClick={() => {
                            const newItems = [...(editForm.items || [])];
                            newItems.splice(idx, 1);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {(!editForm.items || editForm.items.length === 0) && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No items added.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={updateOrderMutation.isPending}>
                    {updateOrderMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={cancelEditing}>Cancel</Button>
                </div>
              </div>
            ) : (
              // READ ONLY VIEW
              <>
                {/* Assign Driver */}
                {!hideDriverAssign && order.stage !== "completed" && order.stage !== "pickup_store" && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Assign Driver</span>
                    </div>
                    <Select
                      value={order.assignedDriverId || ""}
                      onValueChange={handleDriverAssign}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a driver..." />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.filter(d => d.isActive).map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            <div className="flex items-center gap-2">
                              <span>{driver.name}</span>
                              {driver.truckNumber && (
                                <span className="text-xs text-muted-foreground">({driver.truckNumber})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignedDriver && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Currently assigned to: <span className="font-medium text-foreground">{assignedDriver.name}</span>
                        {assignedDriver.truckNumber && <span> • {assignedDriver.truckNumber}</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <Badge variant="secondary">
                    {stageLabels[order.stage] || order.stage}
                  </Badge>
                </div>

                {/* Address */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Address</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.customer.address}</p>
                  {order.customer.phone && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="text-xs opacity-70">Phone:</span> {order.customer.phone}
                    </p>
                  )}
                </div>

                {/* Items */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Items ({order.items.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground flex justify-between">
                        <span>{item.partNumber}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRE SELL for JOBBER */}
                {order.orderType === "JOBBER" && order.presellNumber && (
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-accent">
                        PRE SELL: {order.presellNumber}
                      </span>
                    </div>
                  </div>
                )}

                {/* RSM */}
                {order.rsm && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        <span className="font-medium">RSM:</span> {order.rsm}
                      </span>
                    </div>
                  </div>
                )}

                {/* Comments */}
                {order.comments && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Comments</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{order.comments}</p>
                  </div>
                )}

                {/* Created */}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Created {format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <OrderTimeline orderId={order.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

