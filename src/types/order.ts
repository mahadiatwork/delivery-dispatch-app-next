export type OrderStage =
  | "picking"
  | "unassigned_driver"
  | "assigned_driver"
  | "pickup_store"
  | "completed";

export type OrderType = "DODD" | "JOBBER" | "HOTSHOT" | "PICKUP" | "RESTOCK";

export type AssignedDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | null;

export type PickingColumn = "Unassigned" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Picked";

export type FulfillmentType = "Pickup" | "Delivery" | "Back Order";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Customer {
  name: string;
  id: string;
  address: string;
  phone: string;
  coordinates: Coordinates;
}

export interface LineItem {
  partNumber: string;
  quantity: number;
  poNumber: string;
}

export interface Order {
  id: string;
  customer: Customer;
  items: LineItem[];
  stage: OrderStage;
  scheduledDate: Date | null;
  assignedDay: AssignedDay;
  rsm: string;
  assignedDriverId: string | null;
  orderType: OrderType;
  invoicePhotoUrl: string | null;
  comments: string;
  createdAt: Date;
  pickingColumn: PickingColumn;
  // New fields
  fulfillmentType: FulfillmentType;
  isReady: boolean;
  orderDocumentUrl: string | null; // Image/PDF of the order for driver reference
  presellNumber: string | null; // PRE SELL number for JOBBER orders only

  // Computed lifecycle fields
  pickingStatus: "not_picked" | "picked";
  deliveryStatus: "pending" | "delivered" | "archived";
  driverVisibility: "visible" | "hidden";
  completedAt: Date | null;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  truckNumber: string;
  vehicleType: "truck" | "van" | "hotshot";
  isActive: boolean;
  userId: string | null;
  appAccessEnabled: boolean;
}
