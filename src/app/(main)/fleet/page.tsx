'use client';

import { useState } from "react";
import { useOrderStore } from "@/store/orderStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Car, Truck, Zap, Plus, Phone, Search, Pencil, KeyRound, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriverFormDialog } from "@/components/fleet/DriverFormDialog";
import { GiveAccessDialog } from "@/components/fleet/GiveAccessDialog";
import { Driver } from "@/types/order";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const vehicleIcons = {
    truck: Truck,
    van: Car,
    hotshot: Zap,
};

export default function Fleet() {
    const { drivers } = useOrderStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [accessDriver, setAccessDriver] = useState<Driver | null>(null);
    const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const filteredDrivers = drivers.filter(driver =>
        driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (driver.truckNumber && driver.truckNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleAddDriver = () => {
        setEditingDriver(null);
        setIsFormOpen(true);
    };

    const handleEditDriver = (driver: Driver) => {
        setEditingDriver(driver);
        setIsFormOpen(true);
    };

    const handleGiveAccess = (driver: Driver) => {
        setAccessDriver(driver);
        setIsAccessDialogOpen(true);
    };

    const handleRevokeAccess = async (driver: Driver) => {
        setRevokingId(driver.id);
        try {
            const response = await fetch('/api/drivers/revoke-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || 'Failed to revoke access');
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['drivers'] });
            toast.success(`App access revoked for ${driver.name}`);
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setRevokingId(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Fleet Management</h1>
                    <p className="text-muted-foreground">
                        Manage vehicles and drivers
                    </p>
                </div>
                <Button
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleAddDriver}
                >
                    <Plus className="w-4 h-4" />
                    Add Driver
                </Button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search drivers..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDrivers.map((driver) => {
                    const VehicleIcon = vehicleIcons[driver.vehicleType];
                    return (
                        <Card key={driver.id} className="hover:shadow-card-hover transition-shadow group relative">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center",
                                                driver.isActive
                                                    ? "bg-status-assigned/10 text-status-assigned"
                                                    : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <VehicleIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{driver.name}</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {driver.vehicleType}
                                                </p>
                                                {driver.truckNumber && (
                                                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                                                        {driver.truckNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "px-2 py-0.5 text-xs font-medium rounded-full",
                                            driver.isActive
                                                ? "bg-status-assigned/10 text-status-assigned"
                                                : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {driver.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {driver.email && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{driver.email}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="w-4 h-4 shrink-0" />
                                    <span>{driver.phone || '—'}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-2 flex-wrap">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs gap-1"
                                        onClick={() => handleEditDriver(driver)}
                                    >
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                    </Button>

                                    {driver.appAccessEnabled ? (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-xs text-status-assigned">
                                                <ShieldCheck className="w-3 h-3" />
                                                App access enabled
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                                                onClick={() => handleRevokeAccess(driver)}
                                                disabled={revokingId === driver.id}
                                            >
                                                <ShieldOff className="w-3 h-3" />
                                                Revoke access
                                            </Button>
                                        </>
                                    ) : driver.email ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-primary gap-1"
                                            onClick={() => handleGiveAccess(driver)}
                                        >
                                            <KeyRound className="w-3 h-3" />
                                            Give app access
                                        </Button>
                                    ) : (
                                        <button
                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                            onClick={() => handleEditDriver(driver)}
                                        >
                                            <KeyRound className="w-3 h-3" />
                                            Add email first
                                        </button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <DriverFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                driver={editingDriver}
            />

            <GiveAccessDialog
                open={isAccessDialogOpen}
                onOpenChange={setIsAccessDialogOpen}
                driver={accessDriver}
            />
        </div>
    );
}
