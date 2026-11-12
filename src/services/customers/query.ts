import { customers } from "@/db/schema";
import { db } from "@/db";
import type { NewCustomer } from "@/db/schema/customers";


export async function insertCustomer(customer:NewCustomer) {
    const [newCustomer] =  await db.insert(customers).values({
        ...customer
    }).returning({ id: customers.id, name: customers.name });

    return newCustomer;
}