export type PrintJobStatus =
  | 'queued'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'printer_connect_pending'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface PrintJobEvent {
  id: string;
  status: PrintJobStatus;
  note?: string | null;
  createdAt: string;
}

export interface PrintJob {
  id: string;
  saleId?: string | null;
  jobType?: 'receipt' | 'kot';
  kotOrderId?: string | null;
  requestedById: string;
  requestedByName: string;
  targetAgentId?: string | null;
  targetAgentName?: string | null;
  targetLocationId?: string | null;
  targetLocationName?: string | null;
  paperWidth: '58mm' | '80mm';
  copies: number;
  status: PrintJobStatus;
  failureReason?: string | null;
  acceptedByAgentId?: string | null;
  acceptedByAgentName?: string | null;
  expiresAt: string;
  respondedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sale?: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    createdAt: string;
    customer?: { name: string } | null;
  } | null;
  events?: PrintJobEvent[];
}

export interface CreatePrintJobPayload {
  saleId?: string;
  kotOrderId?: string;
  jobType?: 'receipt' | 'kot';
  targetAgentId?: string;
  targetLocationId?: string;
  paperWidth?: '58mm' | '80mm';
  copies?: number;
}

export interface BusinessDeviceEntry {
  actorId: string;
  actorName: string;
  actorIsManagedUser: boolean;
  platform: string;
  lastSeenAt: string;
}
