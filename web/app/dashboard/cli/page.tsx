import Link from "next/link";
import { BrowserTerminal } from "@/components/browser-terminal";
export default function CliPage(){return <main><div className="page-heading"><div><h1>Terminal</h1><p>Manage variables directly in your browser. No installation required.</p></div><Link href="/docs#cli" className="btn-outline">Command guide</Link></div><BrowserTerminal/></main>;}

