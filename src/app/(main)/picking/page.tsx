'use client';

import { DragDropContext, DropResult, Droppable, Draggable } from "@hello-pangea/dnd";
import { useOrderStore } from "@/store/orderStore";
import { useMoveOrderToColumn, useUpdateOrder } from "@/hooks/useOrders";
import { PickingColumn, Order } from "@/types/order";
import { ChevronLeft, ChevronRight, Calendar, Truck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { OrderCard } from "@/components/ui/order-card";
import { OrderDetailSheet } from "@/components/order/OrderDetailSheet";

const columns: PickingColumn[] = ["Unassigned", "Mon", "Tue", "Wed", "Thu", "Fri", "Picked"];

export default function PickingBoard() {
    const { orders, moveOrderToColumn, updateOrder } = useOrderStore();
    const moveOrderMutation = useMoveOrderToColumn();
    const updateOrderMutation = useUpdateOrder();
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const handleOrderClick = (order: Order) => {
        setSelectedOrder(order);
        setSheetOpen(true);
    };

    // Filter orders that are in picking stage OR unassigned_driver with Unassigned column
    // OR orders that have isReady=false (not ready to go out yet)
    // OR orders that are in the Picked column
    const pickingOrders = orders.filter(
        (o) => o.stage === "picking" ||
            (o.stage === "unassigned_driver" && (o.pickingColumn === "Unassigned" || o.pickingColumn === "Picked")) ||
            o.isReady === false
    );

    const handleDragEnd = (result: DropResult) => {
        const { destination, draggableId } = result;

        if (!destination) return;

        const newColumn = destination.droppableId as PickingColumn;

        // Compute the scheduled date based on the weekday column
        const getDateForColumn = (column: PickingColumn): Date | null => {
            const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
            if (!(column in dayMap)) return null; // Unassigned or Picked

            const today = new Date();
            const currentDay = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + currentWeekOffset * 7);

            const targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + dayMap[column]);
            return targetDate;
        };

        const scheduledDate = getDateForColumn(newColumn);

        // Optimistic update in local store
        moveOrderToColumn(draggableId, newColumn, scheduledDate);

        // Persist to Supabase
        moveOrderMutation.mutate({ orderId: draggableId, newColumn, scheduledDate });
    };

    const handleMarkReady = (order: Order) => {
        // Update order to be ready for dispatch
        updateOrder(order.id, { isReady: true });
        updateOrderMutation.mutate({
            id: order.id,
            updates: { isReady: true }
        });

        toast({
            title: "Order Ready",
            description: `Order for ${order.customer.name} has been moved to Dispatch Control.`,
        });
    };

    const getOrdersForColumn = (column: PickingColumn) =>
        pickingOrders.filter((o) => o.pickingColumn === column);

    // Calculate week dates
    const getWeekDates = () => {
        const today = new Date();
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + currentWeekOffset * 7);

        return {
            start: monday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            end: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
    };

    const weekDates = getWeekDates();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Processing Board</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Schedule and track warehouse processing. Mark orders ready when picked.
                    </p>
                </div>

                {/* Week Navigation */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                            {weekDates.start} - {weekDates.end}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    {currentWeekOffset !== 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentWeekOffset(0)}
                        >
                            Today
                        </Button>
                    )}
                </div>
            </header>

            {/* Board */}
            <div className="flex-1 overflow-x-auto p-6">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex gap-4 h-full min-w-min">
                        {columns.map((column) => {
                            const columnOrders = getOrdersForColumn(column);
                            const isPicked = column === "Picked";
                            const isUnassigned = column === "Unassigned";

                            return (
                                <div
                                    key={column}
                                    className={cn(
                                        "flex flex-col min-w-[280px] w-[280px] bg-kanban-column rounded-xl border border-border/50",
                                        isPicked && "bg-status-completed/5 border-status-completed/20",
                                        isUnassigned && "bg-status-unassigned/5 border-status-unassigned/20"
                                    )}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            {isPicked && <CheckCircle className="w-4 h-4 text-status-completed" />}
                                            <h3 className="font-semibold text-sm text-foreground">{column}</h3>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                                            {columnOrders.length}
                                        </span>
                                    </div>

                                    {/* Droppable Area */}
                                    <Droppable droppableId={column}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={cn(
                                                    "flex-1 p-2 overflow-y-auto scrollbar-thin min-h-[200px] transition-colors duration-200",
                                                    snapshot.isDraggingOver && "bg-kanban-drop-zone"
                                                )}
                                            >
                                                <div className="space-y-2">
                                                    {columnOrders.map((order, index) => (
                                                        <Draggable key={order.id} draggableId={order.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                >
                                                                    {/* Order Card with Ready Button wrapper */}
                                                                    <div
                                                                        className={cn(
                                                                            "relative",
                                                                            !order.isReady && "ring-2 ring-amber-400/50 rounded-lg"
                                                                        )}
                                                                    >
                                                                        {/* Use same OrderCard as Dispatch Control */}
                                                                        <OrderCard
                                                                            order={order}
                                                                            isDragging={snapshot.isDragging}
                                                                            onClick={() => handleOrderClick(order)}
                                                                        />

                                                                        {/* Ready for Dispatch button - only for non-ready orders */}
                                                                        {!order.isReady && (
                                                                            <div className="mt-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleMarkReady(order);
                                                                                    }}
                                                                                >
                                                                                    <Truck className="w-3.5 h-3.5" />
                                                                                    Ready for Dispatch
                                                                                </Button>
                                                                            </div>
                                                                        )}

                                                                        {/* Already ready indicator for picked column */}
                                                                        {order.isReady && isPicked && (
                                                                            <div className="flex items-center gap-1 text-xs text-status-completed mt-2 px-1">
                                                                                <CheckCircle className="w-3 h-3" />
                                                                                Ready for dispatch
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                </div>
                                                {provided.placeholder}

                                                {/* Empty state */}
                                                {columnOrders.length === 0 && !snapshot.isDraggingOver && (
                                                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed border-border rounded-lg">
                                                        Drop orders here
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            </div>
            {/* Order Detail Sheet */}
            <OrderDetailSheet
                order={selectedOrder}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                hideDriverAssign
            />
        </div>
    );
}

