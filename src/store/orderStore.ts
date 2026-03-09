import { create } from 'zustand';
import { Order, PickingColumn, Driver } from '@/types/order';

// This store now acts as a client-side cache that syncs with Supabase
// The actual data fetching is done via React Query hooks in useOrders.ts

// Default drivers - used as fallback when database is empty
const defaultDrivers: Driver[] = [
  { id: 'driver-1', name: 'Justin Scholten', email: '', phone: '', truckNumber: 'T95', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-2', name: 'Kyle Bauman', email: '', phone: '', truckNumber: 'T88', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-3', name: 'Jeff Lince', email: '', phone: '', truckNumber: 'T80', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-4', name: 'Scott Masters', email: '', phone: '', truckNumber: 'T60', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-5', name: 'Rich Martineau', email: '', phone: '', truckNumber: 'T50', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-6', name: 'Chris Nunes', email: '', phone: '', truckNumber: 'T25', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-7', name: 'Andy Long', email: '', phone: '', truckNumber: 'T97', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-8', name: 'Stephen Ives', email: '', phone: '', truckNumber: 'T40', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-9', name: 'Dan Gambin', email: '', phone: '', truckNumber: 'T35', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-10', name: 'Nicole Reynolds', email: '', phone: '', truckNumber: 'T30', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
  { id: 'driver-11', name: 'Paul Chiasson', email: '', phone: '', truckNumber: 'T92', vehicleType: 'truck', isActive: true, userId: null, appAccessEnabled: false },
];

interface OrderStore {
  orders: Order[];
  drivers: Driver[];
  setOrders: (orders: Order[]) => void;
  setDrivers: (drivers: Driver[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  moveOrderToColumn: (orderId: string, newColumn: PickingColumn, scheduledDate?: Date | null) => void;
  assignOrderToDriver: (orderId: string, driverId: string) => void;
  getOrdersByStage: (stage: Order['stage']) => Order[];
  getOrdersByPickingColumn: (column: PickingColumn) => Order[];
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  drivers: defaultDrivers, // Initialize with default drivers

  setOrders: (orders) => set({ orders }),

  setDrivers: (drivers) => set({ drivers }),

  addOrder: (order) => set((state) => ({
    orders: [order, ...state.orders]
  })),

  updateOrder: (id, updates) => set((state) => ({
    orders: state.orders.map(order =>
      order.id === id ? { ...order, ...updates } : order
    )
  })),

  moveOrderToColumn: (orderId, newColumn, scheduledDate) => set((state) => ({
    orders: state.orders.map(order => {
      if (order.id !== orderId) return order;

      const updates: Partial<Order> = { pickingColumn: newColumn };

      // Update assignedDay based on column
      if (newColumn === "Unassigned" || newColumn === "Picked") {
        updates.assignedDay = null;
        updates.scheduledDate = null;
      } else {
        updates.assignedDay = newColumn as Order['assignedDay'];
        if (scheduledDate !== undefined) {
          updates.scheduledDate = scheduledDate;
        }
      }

      // When moved to "Picked", update stage
      if (newColumn === "Picked") {
        updates.stage = "unassigned_driver";
      }

      return { ...order, ...updates };
    })
  })),

  assignOrderToDriver: (orderId, driverId) => set((state) => ({
    orders: state.orders.map(order =>
      order.id === orderId
        ? { ...order, assignedDriverId: driverId, stage: "assigned_driver" as const }
        : order
    )
  })),

  getOrdersByStage: (stage) => get().orders.filter(o => o.stage === stage),

  getOrdersByPickingColumn: (column) => get().orders.filter(o => o.pickingColumn === column),
}));
