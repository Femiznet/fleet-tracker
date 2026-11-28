export interface GreenApiSenderData {
  chatId: string;
  sender: string;
  senderName: string;
  senderContactName?: string;
  chatName?: string;
}

export type Skids = string | string[] | null;

export interface CustomerUpdateMessage {
  PRMS: {
    id: number;
    pressure: number | null;
    flowrate: number | null;
    totalflow: number | null;
    skidinuse: Skids;
  }[];
  outletpressure: number | null;
  standbyskid: Skids;
  emptyskid: Skids;
  availabletrucks: number | string[] | null;
  reportedAt: string | null;
}

export interface DispatchDetails {
  truckNumber: string | null;
  skidNumber: string | null;
  driverName: string | null;
  customerName: string | null;
  dateOut: string | null;
  timeOut: string | null;
  driverContact: string | null;
}
