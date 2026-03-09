import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Order, Driver, PickingColumn, OrderType, OrderStage, LineItem, AssignedDay } from "@/types/order";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Transform Supabase order to frontend Order type
const transformOrder = (dbOrder: any): Order => ({
  id: dbOrder.id,
  customer: {
    name: dbOrder.customer_name,
    id: dbOrder.customer_id || "",
    address: dbOrder.customer_address || "",
    phone: dbOrder.customer_phone || "",
    coordinates: {
      lat: dbOrder.customer_lat || 0,
      lng: dbOrder.customer_lng || 0,
    },
  },
  items: (dbOrder.items as LineItem[]) || [],
  stage: dbOrder.stage as OrderStage,
  scheduledDate: dbOrder.scheduled_date ? new Date(dbOrder.scheduled_date) : null,
  assignedDay: dbOrder.assigned_day as AssignedDay,
  rsm: dbOrder.rsm || "",
  assignedDriverId: dbOrder.assigned_driver_id,
  orderType: dbOrder.order_type as OrderType,
  invoicePhotoUrl: dbOrder.invoice_photo_url,
  comments: dbOrder.comments || "",
  createdAt: new Date(dbOrder.created_at),
  pickingColumn: dbOrder.picking_column as PickingColumn,
  orderDocumentUrl: dbOrder.order_document_url,
  presellNumber: dbOrder.presell_number,
  fulfillmentType: (dbOrder.fulfillment_type as any) || "Delivery",
  isReady: dbOrder.is_ready ?? true,
  pickingStatus: dbOrder.picking_column === "Picked" ? "picked" : "not_picked",
  deliveryStatus: dbOrder.stage === "completed" ? "delivered" : "pending",
  driverVisibility: dbOrder.stage === "completed" ? "hidden" : "visible",
  completedAt: dbOrder.stage === "completed" ? new Date(dbOrder.updated_at) : null,
});

// Transform Supabase driver to frontend Driver type
const transformDriver = (dbDriver: any): Driver => ({
  id: dbDriver.id,
  name: dbDriver.name,
  email: dbDriver.email || "",
  phone: dbDriver.phone || "",
  truckNumber: dbDriver.truck_number || "",
  vehicleType: dbDriver.vehicle_type as "truck" | "van" | "hotshot",
  isActive: dbDriver.is_active,
  userId: dbDriver.user_id || null,
  appAccessEnabled: dbDriver.app_access_enabled ?? false,
});

// Fetch all orders
export const useOrders = () => {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map(transformOrder);
    },
  });
};

// Fetch all drivers
export const useDrivers = () => {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .order("name");

      if (error) throw error;
      return data.map(transformDriver);
    },
  });
};

// Create a new order
export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: Omit<Order, "id" | "createdAt" | "pickingStatus" | "deliveryStatus" | "driverVisibility" | "completedAt">) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Generate order number
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const insertData: TablesInsert<"orders"> = {
        order_number: orderNumber,
        customer_name: order.customer.name,
        customer_id: order.customer.id,
        customer_address: order.customer.address,
        customer_phone: order.customer.phone,
        customer_lat: order.customer.coordinates.lat,
        customer_lng: order.customer.coordinates.lng,
        items: order.items as any,
        stage: order.stage,
        scheduled_date: order.scheduledDate?.toISOString().split("T")[0] || null,
        assigned_day: order.assignedDay as TablesInsert<"orders">["assigned_day"],
        rsm: order.rsm,
        assigned_driver_id: order.assignedDriverId && !order.assignedDriverId.startsWith('driver-') ? order.assignedDriverId : null,
        order_type: order.orderType as TablesInsert<"orders">["order_type"],
        invoice_photo_url: order.invoicePhotoUrl,
        comments: order.comments,
        picking_column: order.pickingColumn as TablesInsert<"orders">["picking_column"],
        order_document_url: order.orderDocumentUrl,
        presell_number: order.presellNumber,
        fulfillment_type: order.fulfillmentType,
        is_ready: order.isReady,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return transformOrder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Update an order
export const useUpdateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Order> }) => {
      const dbUpdates: TablesUpdate<"orders"> = {};

      if (updates.customer) {
        if (updates.customer.name !== undefined) dbUpdates.customer_name = updates.customer.name;
        if (updates.customer.id !== undefined) dbUpdates.customer_id = updates.customer.id;
        if (updates.customer.address !== undefined) dbUpdates.customer_address = updates.customer.address;
        if (updates.customer.phone !== undefined) dbUpdates.customer_phone = updates.customer.phone;
        if (updates.customer.coordinates) {
          dbUpdates.customer_lat = updates.customer.coordinates.lat;
          dbUpdates.customer_lng = updates.customer.coordinates.lng;
        }
      }
      if (updates.items !== undefined) dbUpdates.items = updates.items as any;
      if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
      if (updates.scheduledDate !== undefined) {
        dbUpdates.scheduled_date = updates.scheduledDate?.toISOString().split("T")[0] || null;
      }
      if (updates.assignedDay !== undefined) dbUpdates.assigned_day = updates.assignedDay as TablesUpdate<"orders">["assigned_day"];
      if (updates.rsm !== undefined) dbUpdates.rsm = updates.rsm;
      if (updates.assignedDriverId !== undefined) dbUpdates.assigned_driver_id = updates.assignedDriverId;
      if (updates.orderType !== undefined) dbUpdates.order_type = updates.orderType as TablesUpdate<"orders">["order_type"];
      if (updates.invoicePhotoUrl !== undefined) dbUpdates.invoice_photo_url = updates.invoicePhotoUrl;
      if (updates.comments !== undefined) dbUpdates.comments = updates.comments;
      if (updates.pickingColumn !== undefined) dbUpdates.picking_column = updates.pickingColumn as TablesUpdate<"orders">["picking_column"];
      if (updates.orderDocumentUrl !== undefined) dbUpdates.order_document_url = updates.orderDocumentUrl;
      if (updates.presellNumber !== undefined) dbUpdates.presell_number = updates.presellNumber;
      if (updates.fulfillmentType !== undefined) dbUpdates.fulfillment_type = updates.fulfillmentType;
      if (updates.isReady !== undefined) dbUpdates.is_ready = updates.isReady;

      const { data, error } = await supabase
        .from("orders")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return transformOrder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Move order to a new picking column
export const useMoveOrderToColumn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, newColumn, scheduledDate }: { orderId: string; newColumn: PickingColumn; scheduledDate?: Date | null }) => {
      const updates: TablesUpdate<"orders"> = {
        picking_column: newColumn as TablesUpdate<"orders">["picking_column"]
      };

      // Update assignedDay based on column
      if (newColumn === "Unassigned" || newColumn === "Picked") {
        updates.assigned_day = null;
        updates.scheduled_date = null;
      } else {
        updates.assigned_day = newColumn as TablesUpdate<"orders">["assigned_day"];
        if (scheduledDate !== undefined) {
          updates.scheduled_date = scheduledDate ? scheduledDate.toISOString().split("T")[0] : null;
        }
      }

      // When moved to "Picked", update stage
      if (newColumn === "Picked") {
        updates.stage = "unassigned_driver";
      }

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;
      return transformOrder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Assign order to driver
export const useAssignOrderToDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, driverId }: { orderId: string; driverId: string }) => {
      const { data, error } = await supabase
        .from("orders")
        .update({
          assigned_driver_id: driverId,
          stage: "assigned_driver" as const,
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;
      return transformOrder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

// Create a new driver (globally shared - no user_id)
export const useCreateDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (driver: Omit<Driver, "id">) => {
      // Get current user to verify authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const insertData: TablesInsert<"drivers"> = {
        name: driver.name,
        email: driver.email || null,
        phone: driver.phone,
        truck_number: driver.truckNumber || null,
        vehicle_type: driver.vehicleType,
        is_active: driver.isActive,
        user_id: null,
      };

      const { data, error } = await supabase
        .from("drivers")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return transformDriver(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
};


// Update a driver
export const useUpdateDriver = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Driver> }) => {
      const dbUpdates: TablesUpdate<"drivers"> = {};

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.email !== undefined) dbUpdates.email = updates.email || null;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.vehicleType !== undefined) dbUpdates.vehicle_type = updates.vehicleType;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      const { data, error } = await supabase
        .from("drivers")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return transformDriver(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
};
