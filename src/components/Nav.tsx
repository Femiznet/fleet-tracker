import Link from "next/link";

const links = [
  { href: "/", label: "Trucks" },
  { href: "/registry", label: "Locations" },
  { href: "/crew", label: "Crew" },
];

export function Nav() {
  return (
    <nav className="bg-slate-900 text-white px-4 py-2 flex gap-4 text-sm">
      <strong className="tracking-widest">GASTECH</strong>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="text-slate-300 hover:text-white">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}