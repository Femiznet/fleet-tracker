import { CustomerInput, registerCustomer } from "@/app/customers/actions";


export async function POST(request: Request) {
    const body = await request.json() as CustomerInput;

    const data = await registerCustomer({ data: body });
    
    return Response.json({ data }, { status: 200 });
}