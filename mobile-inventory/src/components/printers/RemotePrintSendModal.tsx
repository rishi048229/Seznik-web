import React from 'react';
import { Alert } from 'react-native';
import { RemotePrintTargetPicker } from './RemotePrintTargetPicker';
import { usePrintJobsAdmin } from '@/hooks/usePrintJobs';
import { PrintJob } from '@/types/printJob';
import { Sale } from '@/types/sale';
import { sanitizeErrorMessage } from '@/utils/errorHandler';

interface RemotePrintSendModalProps {
  visible: boolean;
  onClose: () => void;
  sale: Sale | null;
  /** Fires with the created job so the caller can open its live status screen. */
  onSent?: (job: PrintJob) => void;
}

/** Sends an already-made sale's receipt to a teammate's phone to print. They get a notification,
 *  accept it, and it prints on whichever printer is connected there — or they're walked through
 *  connecting one first. */
export const RemotePrintSendModal: React.FC<RemotePrintSendModalProps> = ({ visible, onClose, sale, onSent }) => {
  const { sendJob, isSending } = usePrintJobsAdmin();

  const handleSubmit = async (agentId: string) => {
    if (!sale) return;
    try {
      const job = await sendJob({ saleId: sale.id, targetAgentId: agentId, paperWidth: '80mm' });
      onClose();
      onSent?.(job);
    } catch (err: any) {
      Alert.alert('Could not send', sanitizeErrorMessage(err, 'Please try again.'));
    }
  };

  return (
    <RemotePrintTargetPicker
      visible={visible}
      onClose={onClose}
      title="Send to Print Remotely"
      subtitle={sale ? `Invoice ${sale.invoiceNumber} · ₹${sale.grandTotal.toFixed(2)}` : undefined}
      submitLabel="Send Receipt"
      isSubmitting={isSending}
      onSubmit={handleSubmit}
    />
  );
};
