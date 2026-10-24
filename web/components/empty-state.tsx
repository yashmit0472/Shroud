import Link from "next/link";
export function EmptyState({ title, description, href, action }: { title:string; description:string; href?:string; action?:string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{description}</p>{href && action && <Link className="btn-outline mt-2" href={href}>{action}</Link>}</div>;
}
export function PageSkeleton() { return <main aria-label="Loading" aria-busy="true" className="space-y-5 p-6"><div className="skeleton w-40" /><div className="skeleton w-64" /><div className="surface-card">{[1,2,3,4].map(index => <div className="skeleton-row" key={index}><div className="skeleton w-3/5" /></div>)}</div></main>; }
