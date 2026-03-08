import { Order } from "@/types/order";
import { cn } from "@/lib/utils";
import { Package, MapPin, Clock, FileText, Tag, CalendarDays } from "lucide-react";

interface OrderCardProps {
  order: Order;
  isDragging?: boolean;
  onClick?: () => void;
}

const orderTypeStyles: Record<string, string> = {
  DODD: "bg-primary/10 text-primary border-primary/20",
  JOBBER: "bg-accent/10 text-accent border-accent/20",
  HOTSHOT: "bg-destructive/10 text-destructive border-destructive/20",
  PICKUP: "bg-status-pickup/10 text-status-pickup border-status-pickup/20",
};

export function OrderCard({ order, isDragging, onClick }: OrderCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-kanban-card border border-border rounded-lg p-3 shadow-card transition-all duration-200",
        isDragging && "shadow-kanban rotate-2 scale-105",
        !isDragging && "hover:shadow-card-hover hover:border-accent/30",
        onClick && "cursor-pointer"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {order.customer.name}
            </h4>
            {/* Driver Board Indicators */}
            {order.stage !== 'completed' && (
              <>
                <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center p-0.5" title="Scheduled / Active">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-green-600" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">#{order.customer.id}</p>
            {order.pickingStatus === "picked" && order.stage !== 'completed' && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500 text-white rounded shadow-sm animate-in fade-in zoom-in duration-300">
                Picked
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 text-xs font-medium rounded border",
            orderTypeStyles[order.orderType]
          )}
        >
          {order.orderType}
        </span>
      </div>

      {/* Address */}
      <div className="flex items-start gap-1.5 mb-2">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground line-clamp-2">
          {order.customer.address}
        </p>
      </div>

      {/* Items summary */}
      <div className="flex items-center gap-1.5 mb-2">
        <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          {order.items.length} item{order.items.length !== 1 ? "s" : ""} •{" "}
          {order.items.reduce((acc, item) => acc + item.quantity, 0)} units
        </p>
      </div>

      {/* PRE SELL Badge for JOBBER orders */}
      {order.orderType === "JOBBER" && order.presellNumber && (
        <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-accent/10 rounded border border-accent/20">
          <Tag className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="text-xs font-medium text-accent">
            PRE SELL: {order.presellNumber}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {order.scheduledDate ? (
            <>
              <CalendarDays className="w-3 h-3 text-primary" />
              <span className="text-primary font-medium">
                {new Date(order.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {order.orderDocumentUrl && (
            <FileText className="w-3.5 h-3.5 text-accent" />
          )}
          {order.comments && (
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-subtle" title="Has comments" />
          )}
        </div>
      </div>
    </div>
  );
}
