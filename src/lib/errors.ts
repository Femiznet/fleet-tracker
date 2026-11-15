
interface DebugValueInputType {
    success?: boolean;
    data?: object;
    message?: string;
    error?: Error;
}

export function returnValueDebugger(input: unknown) {
    const value = input as DebugValueInputType;

    if (!value.success) {
        console.log("FAILURE MESSAGE:", value.message);
        console.error("ERROR:", value.error);
    } else {
        console.log("SUCCESSFUL MESSAGE:", value.message);
        console.log("DATA:", value.data);
    }
}