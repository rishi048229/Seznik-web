import React from 'react';
import { Alert } from 'react-native';
import { RemotePrintTargetPicker } from './RemotePrintTargetPicker';
import { usePrintJobsAdmin } from '@/hooks/usePrintJobs';
import { PrintJob } from '@/types/printJob';
import { KOTOrder } from '@/types/kot';
import { sanitizeErrorMessage } from '@/utils/errorHandler';
import { useRemotePrintPaperWidth } from '@/utils/remotePrintPaperWidth';

interface RemotePrintSendKotModalProps {
  visible: boolean;
  onClose: () => void;
  order: KOTOrder | null;
  onSent?: (job: PrintJob) => void;
}

/** Sends a kitchen KOT ticket to a teammate's phone to print on their connected printer. */
export const RemotePrintSendKotModal: React.FC<RemotePrintSendKotModalProps> = ({
  visible,
  onClose,
  order,
  onSent,
}) => {
  const { sendJob, isSending } = usePrintJobsAdmin();
  const paperWidth = useRemotePrintPaperWidth();

  const handleSubmit = async (agentId: string) => {
    if (!order) return;
    try {
      const job = await sendJob({
        kotOrderId: order.id,
        jobType: 'kot',
        targetAgentId: agentId,
        paperWidth,
      });
      onClose();
      onSent?.(job);
    } catch (err: any) {
      Alert.alert('Could not send', sanitizeErrorMessage(err, 'Please try again.'));
    }
  };

  const label = order ? `KOT #${String(order.orderNumber).padStart(4, '0')}` : undefined;

  return (
    <RemotePrintTargetPicker
      visible={visible}
      onClose={onClose}
      title="Send KOT to Print Remotely"
      subtitle={label ? `${label} · ${order?.table?.name || order?.partyLabel || 'Kitchen ticket'}` : undefined}
      submitLabel="Send KOT"
      isSubmitting={isSending}
      onSubmit={handleSubmit}
    />
  );
};
