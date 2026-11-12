import { CustomerType } from "@/db/schema/customers";
import { insertCustomer } from "@/services/customers/query";


export interface CustomerInput {
    name: string;
    latitude?: number;
    longitude?: number;
    type?: CustomerType;
    relative_time?: string;
    cutoff_pressure?: number;
   }

export async function registerCustomer({ data }: { data: CustomerInput }) {
    return await insertCustomer(data);
}