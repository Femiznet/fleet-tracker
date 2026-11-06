import SignOutButton from "@/components/sign-out-button";

export default function AdminPage() {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-sm opacity-70">
          Manage stations and monitor customer reports.
        </p>
        <SignOutButton/>
        
      </main>
    );
  }