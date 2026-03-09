'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail } from 'lucide-react';
import { useCreateDriver, useUpdateDriver } from '@/hooks/useOrders';
import { Driver } from '@/types/order';
import { toast } from 'sonner';

const driverFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    vehicleType: z.enum(['truck', 'van', 'hotshot'], {
        required_error: "Vehicle type is required",
    }),
    truckNumber: z.string().optional(),
    isActive: z.boolean().default(true),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface DriverFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    driver?: Driver | null; // If provided, we're in edit mode
}

export function DriverFormDialog({ open, onOpenChange, driver }: DriverFormDialogProps) {
    const isEditMode = !!driver;
    const createDriver = useCreateDriver();
    const updateDriver = useUpdateDriver();

    const form = useForm<DriverFormValues>({
        resolver: zodResolver(driverFormSchema),
        defaultValues: {
            name: driver?.name ?? '',
            email: driver?.email ?? '',
            phone: driver?.phone ?? '',
            vehicleType: driver?.vehicleType ?? 'truck',
            truckNumber: driver?.truckNumber ?? '',
            isActive: driver?.isActive ?? true,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: driver?.name ?? '',
                email: driver?.email ?? '',
                phone: driver?.phone ?? '',
                vehicleType: driver?.vehicleType ?? 'truck',
                truckNumber: driver?.truckNumber ?? '',
                isActive: driver?.isActive ?? true,
            });
        }
    }, [open, driver, form]);

    const onSubmit = async (values: DriverFormValues) => {
        try {
            if (isEditMode && driver) {
                await updateDriver.mutateAsync({
                    id: driver.id,
                    updates: values,
                });
                toast.success('Driver updated successfully');
            } else {
                await createDriver.mutateAsync({
                    name: values.name,
                    email: values.email || '',
                    phone: values.phone || '',
                    truckNumber: values.truckNumber || '',
                    vehicleType: values.vehicleType,
                    isActive: values.isActive,
                    userId: null,
                    appAccessEnabled: false,
                });
                toast.success('Driver added successfully');
            }
            form.reset();
            onOpenChange(false);
        } catch (error) {
            toast.error(`Failed to ${isEditMode ? 'update' : 'add'} driver`);
            console.error(error);
        }
    };

    const isPending = createDriver.isPending || updateDriver.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Update the driver details below.'
                            : 'Fill in the details to add a new driver to your fleet.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Driver name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input placeholder="driver@example.com" className="pl-10" {...field} />
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        Required for giving driver app access.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Phone number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="truckNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Truck/Vehicle #</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. T-101" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="vehicleType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle Type *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select vehicle type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="truck">Truck</SelectItem>
                                            <SelectItem value="van">Van</SelectItem>
                                            <SelectItem value="hotshot">Hotshot</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Active Status</FormLabel>
                                        <FormDescription>
                                            Disable this if the driver is unavailable.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Save Changes' : 'Add Driver'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
