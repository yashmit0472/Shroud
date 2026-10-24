import Link from "next/link";
export default function NotFound(){return <main><div className="empty-state"><strong>This destination is unavailable.</strong><p>The project or resource may have been removed, or your account may not have access.</p><Link href="/dashboard/projects" className="btn-outline">Back to projects</Link></div></main>;}
