import SignOutButton from "@/components/sign-out-button";

export default function DashboardPage() {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Customer Dashboard</h1>
        <p className="mt-2 text-sm opacity-70">
          Welcome to your station dashboard.
        </p>
        <SignOutButton/>
      </main>
    );
  }