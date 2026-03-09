'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Check } from 'lucide-react';
import { Driver } from '@/types/order';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface GiveAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
}

export function GiveAccessDialog({ open, onOpenChange, driver }: GiveAccessDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && driver) {
      setEmail(driver.email || '');
      setPassword('');
      setResult(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!driver || !email.trim()) return;
    setIsPending(true);

    try {
      const response = await fetch('/api/drivers/give-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          email: email.trim(),
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to give access');
        return;
      }

      setResult({ tempPassword: data.tempPassword, emailSent: data.emailSent });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(
        data.emailSent
          ? 'App access granted and login emailed to driver'
          : 'App access granted'
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `Email: ${email}\nTemporary Password: ${result.tempPassword}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Give App Access – {driver?.name}</DialogTitle>
          <DialogDescription>
            Create a login for this driver so they can use the mobile app.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="access-email">Login Email</Label>
              <Input
                id="access-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-password">Temporary Password (optional)</Label>
              <Input
                id="access-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
              <p className="text-xs text-muted-foreground">
                If left blank, a secure temporary password will be generated.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || !email.trim()}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Login
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm"><span className="font-medium">Email:</span> {email}</p>
              <p className="text-sm">
                <span className="font-medium">Temporary Password:</span>{' '}
                <code className="bg-background px-1.5 py-0.5 rounded text-sm">{result.tempPassword}</code>
              </p>
              {result.emailSent && (
                <p className="text-xs text-status-assigned">Login email sent to driver.</p>
              )}
              {!result.emailSent && (
                <p className="text-xs text-muted-foreground">
                  Email not sent. Please share the credentials manually.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy Credentials'}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
