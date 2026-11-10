"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { toast } from "@/lib/toast";
import { expertAdminApi, type ExpertRefund } from "@/modules/expert/services/expert";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "no time set";

/**
 * Expert sessions that owe the parent a refund. They used to be reachable only from inside one
 * expert's session list, so a refund owed on an expert session never appeared on this page.
 */
export function ExpertRefundsSection() {
  const [refunds, setRefunds] = useState<ExpertRefund[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Bumped after a refund, so the list is fetched again.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(async () => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    expertAdminApi
      .getRefunds()
      .then((res) => {
        if (!cancelled) setRefunds(res.success && Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setRefunds([]);
        toast.error(errorMessage(err, "Could not load expert session refunds."));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refund = async (item: ExpertRefund) => {
    const how = item.canRefundViaPhonePe
      ? `Refund ₹${item.amount} to ${item.parentName} through PhonePe?`
      : `There is no PhonePe order for this session, so transfer ₹${item.amount} to ${item.parentName} by hand first. Mark it as refunded?`;
    if (!window.confirm(how)) return;
    setBusy(item.id);
    try {
      await expertAdminApi.markRefundDone(item.id);
      toast.success(
        item.canRefundViaPhonePe
          ? "Refund sent to PhonePe. If PhonePe refuses it, the server log says so and it needs a bank transfer."
          : "Marked as refunded."
      );
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not process that refund."));
    } finally {
      setBusy(null);
    }
  };

  if (!refunds || refunds.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Expert sessions ({refunds.length})</h2>
      {refunds.map((item) => (
        <Card key={item.id} className="overflow-hidden border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg bg-amber-100 p-2">
                  <Clock size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{item.parentName}</h3>
                  <p className="text-xs text-slate-500">
                    Session with {item.expertName} · {when(item.scheduledAt)}
                    {item.bookedVia === "WHATSAPP" ? " · booked on WhatsApp" : ""}
                  </p>
                </div>
              </div>
              {item.parentEmail && (
                <p className="mt-2 text-sm text-slate-600">{item.parentEmail}</p>
              )}
              {item.cancelReason && (
                <p className="mt-1 text-xs text-slate-500">Cancelled: {item.cancelReason}</p>
              )}
            </div>
            <div className="flex items-center gap-6">
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                ₹{item.amount.toLocaleString("en-IN")}
              </p>
              <Button
                onClick={() => refund(item)}
                variant="primary"
                size="md"
                loading={busy === item.id}
              >
                {item.canRefundViaPhonePe ? "Refund" : "Mark refunded"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
